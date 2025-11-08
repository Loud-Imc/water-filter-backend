export interface StateData {
  stateName: string;
}

export interface DistrictData {
  districtName: string;
}

export class IndiaPlacesHelper {
  /**
   * Get hardcoded states (Kerala only for now)
   */
  static getStates(): StateData[] {
    return [{ stateName: 'Kerala' }];
  }

  /**
   * Get hardcoded Kerala districts
   */
  static getDistricts(stateName: string): DistrictData[] {
    if (stateName !== 'Kerala') {
      return [];
    }

    const keralaDistricts = [
      'Ernakulam',
      'Kottayam',
      'Thrissur',
      'Kozhikode',
      'Kannur',
      'Palakkad',
      'Thiruvananthapuram',
      'Kollam',
      'Malappuram',
      'Wayanad',
      'Idukki',
      'Alappuzha',
      'Pathanamthitta',
      'Kasargod',
    ];

    return keralaDistricts.map((district) => ({ districtName: district }));
  }
}
