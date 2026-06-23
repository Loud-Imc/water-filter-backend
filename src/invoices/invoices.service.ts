import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { InvoiceType } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateInvoiceDto, userId: string) {
    const invoiceNumber =
      data.invoiceNumber ||
      `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Validate invoice number is unique
    const existing = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
    });
    if (existing) {
      throw new BadRequestException('Invoice number already exists');
    }

    if (data.items.length === 0) {
      throw new BadRequestException('Invoice must contain at least one item');
    }

    // Run inside database transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      let calculatedSubTotal = 0;
      let calculatedTaxAmount = 0;
      const invoiceItemsData: any[] = [];

      for (const item of data.items) {
        if (!item.productId && !item.sparePartId) {
          throw new BadRequestException(
            'Each item must have either a productId or sparePartId',
          );
        }
        if (item.productId && item.sparePartId) {
          throw new BadRequestException(
            'An item cannot have both a productId and a sparePartId',
          );
        }

        const quantity = item.quantity;
        const unitPrice = item.unitPrice;
        const taxRate = item.taxRate !== undefined ? item.taxRate : 18.0;
        const itemSubtotal = unitPrice * quantity;
        const itemTax = itemSubtotal * (taxRate / 100);
        const itemTotal = itemSubtotal + itemTax;

        calculatedSubTotal += itemSubtotal;
        calculatedTaxAmount += itemTax;

        // Perform stock updates and history logging based on Invoice Type
        if (item.productId) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new NotFoundException(`Product with ID ${item.productId} not found`);
          }

          let stockChange = 0;
          if (data.type === InvoiceType.PURCHASE || data.type === InvoiceType.SALES_RETURN) {
            stockChange = quantity;
          } else if (data.type === InvoiceType.SALES || data.type === InvoiceType.SUPPLIER_RETURN) {
            if (!data.serviceRequestId) {
              stockChange = -quantity;
            }
          }

          if (stockChange !== 0) {
            const newStock = product.stock + stockChange;
            if (newStock < 0) {
              throw new BadRequestException(
                `Insufficient stock for product "${product.name}". Current: ${product.stock}, Requested reduction: ${quantity}`,
              );
            }

            // Log Product Stock History
            await tx.productStockHistory.create({
              data: {
                productId: item.productId,
                quantityChange: stockChange,
                reason: `${data.type.replace('_', ' ')} Invoice: ${invoiceNumber}`,
              },
            });
          }

          const updateData: any = {};
          if (stockChange !== 0) {
            updateData.stock = product.stock + stockChange;
          }
          if (data.type === InvoiceType.PURCHASE && (product.costPrice !== unitPrice || product.taxRate !== taxRate)) {
            updateData.costPrice = unitPrice;
            updateData.taxRate = taxRate;
          }

          if (Object.keys(updateData).length > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: updateData,
            });
          }

        } else if (item.sparePartId) {
          const sparePart = await tx.sparePart.findUnique({
            where: { id: item.sparePartId },
          });
          if (!sparePart) {
            throw new NotFoundException(
              `Spare part with ID ${item.sparePartId} not found`,
            );
          }

          let stockChange = 0;
          if (data.type === InvoiceType.PURCHASE || data.type === InvoiceType.SALES_RETURN) {
            stockChange = quantity;
          } else if (data.type === InvoiceType.SALES || data.type === InvoiceType.SUPPLIER_RETURN) {
            if (!data.serviceRequestId) {
              stockChange = -quantity;
            }
          }

          if (stockChange !== 0) {
            const newStock = sparePart.stock + stockChange;
            if (newStock < 0) {
              throw new BadRequestException(
                `Insufficient stock for spare part "${sparePart.name}". Current: ${sparePart.stock}, Requested reduction: ${quantity}`,
              );
            }

            // Log Spare Part Stock History
            await tx.sparePartStockHistory.create({
              data: {
                sparePartId: item.sparePartId,
                quantityChange: stockChange,
                reason: `${data.type.replace('_', ' ')} Invoice: ${invoiceNumber}`,
              },
            });
          }

          const updateData: any = {};
          if (stockChange !== 0) {
            updateData.stock = sparePart.stock + stockChange;
          }
          if (data.type === InvoiceType.PURCHASE && (sparePart.costPrice !== unitPrice || sparePart.taxRate !== taxRate)) {
            updateData.costPrice = unitPrice;
            updateData.taxRate = taxRate;
          }

          if (Object.keys(updateData).length > 0) {
            await tx.sparePart.update({
              where: { id: item.sparePartId },
              data: updateData,
            });
          }
        }

        invoiceItemsData.push({
          productId: item.productId || null,
          sparePartId: item.sparePartId || null,
          quantity,
          unitPrice,
          taxRate,
          taxAmount: itemTax,
          totalPrice: itemTotal,
        });
      }

      // Check discount and final calculations
      const discount = data.discount || 0;
      const calculatedTotalAmount = calculatedSubTotal - discount + calculatedTaxAmount;

      return tx.invoice.create({
        data: {
          invoiceNumber,
          type: data.type,
          date: data.date ? new Date(data.date) : new Date(),
          customerId: data.customerId || null,
          supplierId: data.supplierId || null,
          serviceRequestId: data.serviceRequestId || null,
          subTotal: calculatedSubTotal,
          discount,
          taxAmount: calculatedTaxAmount,
          totalAmount: calculatedTotalAmount,
          amountPaid: data.amountPaid || 0,
          paymentStatus: data.paymentStatus || 'UNPAID',
          paymentMode: data.paymentMode || 'CASH',
          notes: data.notes || null,
          createdById: userId,
          items: {
            create: invoiceItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: true,
              sparePart: true,
            },
          },
          supplier: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  }

  async findAll(query: InvoiceQueryDto) {
    const where: any = {};

    if (query.type) {
      where.type = query.type;
    }
    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.date.lte = new Date(query.endDate);
      }
    }

    if (query.productId) {
      where.items = { some: { productId: query.productId } };
    } else if (query.sparePartId) {
      where.items = { some: { sparePartId: query.sparePartId } };
    }

    const includeItems = !!(query.productId || query.sparePartId);

    return this.prisma.invoice.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            primaryPhone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
        ...(includeItems && {
          items: {
            where: {
              ...(query.productId && { productId: query.productId }),
              ...(query.sparePartId && { sparePartId: query.sparePartId }),
            },
          },
        }),
      },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            sparePart: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        supplier: true,
        customer: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async generateFromServiceRequest(serviceRequestId: string, userId: string) {
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        customer: true,
        usedProducts: {
          include: {
            product: true,
            sparePart: true,
          },
        },
      },
    });

    if (!serviceRequest) {
      throw new NotFoundException(`Service request with ID ${serviceRequestId} not found`);
    }

    // Check if an invoice is already generated for this serviceRequest
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { serviceRequestId },
    });
    if (existingInvoice) {
      throw new BadRequestException(
        `An invoice has already been generated for this Service Request: ${existingInvoice.invoiceNumber}`,
      );
    }

    if (serviceRequest.usedProducts.length === 0) {
      throw new BadRequestException('Service request has no used products/spare parts to invoice');
    }

    const invoiceNumber = `INV-SRV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return this.prisma.$transaction(async (tx) => {
      let calculatedSubTotal = 0;
      let calculatedTaxAmount = 0;
      const invoiceItemsData: any[] = [];

      for (const item of serviceRequest.usedProducts) {
        const quantity = item.quantityUsed;
        let unitPrice = 0;
        let taxRate = 18.0;

        if (item.productId && item.product) {
          unitPrice = item.product.price;
          taxRate = item.product.taxRate !== undefined ? item.product.taxRate : 18.0;
        } else if (item.sparePartId && item.sparePart) {
          unitPrice = item.sparePart.price;
          taxRate = item.sparePart.taxRate !== undefined ? item.sparePart.taxRate : 18.0;
        }

        const itemSubtotal = unitPrice * quantity;
        const itemTax = itemSubtotal * (taxRate / 100);
        const itemTotal = itemSubtotal + itemTax;

        calculatedSubTotal += itemSubtotal;
        calculatedTaxAmount += itemTax;

        invoiceItemsData.push({
          productId: item.productId || null,
          sparePartId: item.sparePartId || null,
          quantity,
          unitPrice,
          taxRate,
          taxAmount: itemTax,
          totalPrice: itemTotal,
        });
      }

      const calculatedTotalAmount = calculatedSubTotal + calculatedTaxAmount;

      return tx.invoice.create({
        data: {
          invoiceNumber,
          type: InvoiceType.SALES,
          customerId: serviceRequest.customerId,
          serviceRequestId: serviceRequest.id,
          subTotal: calculatedSubTotal,
          discount: 0,
          taxAmount: calculatedTaxAmount,
          totalAmount: calculatedTotalAmount,
          amountPaid: 0,
          paymentStatus: 'UNPAID',
          paymentMode: 'CASH',
          notes: `Generated from Service Request #${serviceRequest.id}`,
          createdById: userId,
          items: {
            create: invoiceItemsData,
          },
        },
        include: {
          items: {
            include: {
              product: true,
              sparePart: true,
            },
          },
          supplier: true,
          customer: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  }
}
