// Common zipcode ranges for US states (approximate)
// This is a simplified validation - for production, consider using USPS API
const STATE_ZIPCODE_RANGES: Record<string, { min: number; max: number }> = {
  "TX": { min: 75000, max: 79999 }, // Texas: 75000-79999
  "CA": { min: 90000, max: 96699 }, // California: 90000-96699
  "NY": { min: 10000, max: 14999 }, // New York: 10000-14999
  "FL": { min: 32000, max: 34999 }, // Florida: 32000-34999
  "IL": { min: 60000, max: 62999 }, // Illinois: 60000-62999
  "PA": { min: 15000, max: 19999 }, // Pennsylvania: 15000-19999
  "OH": { min: 43000, max: 45999 }, // Ohio: 43000-45999
  "GA": { min: 30000, max: 31999 }, // Georgia: 30000-31999
  "NC": { min: 27000, max: 28999 }, // North Carolina: 27000-28999
  "MI": { min: 48000, max: 49999 }, // Michigan: 48000-49999
  "NJ": { min: 7000, max: 8999 },   // New Jersey: 07000-08999
  "VA": { min: 22000, max: 24699 }, // Virginia: 22000-24699
  "WA": { min: 98000, max: 99999 }, // Washington: 98000-99999
  "AZ": { min: 85000, max: 86599 }, // Arizona: 85000-86599
  "MA": { min: 1000, max: 2799 },   // Massachusetts: 01000-02799
  "TN": { min: 37000, max: 38999 }, // Tennessee: 37000-38999
  "IN": { min: 46000, max: 47999 }, // Indiana: 46000-47999
  "MO": { min: 63000, max: 65999 }, // Missouri: 63000-65999
  "MD": { min: 20600, max: 21999 }, // Maryland: 20600-21999
  "WI": { min: 53000, max: 54999 }, // Wisconsin: 53000-54999
  "CO": { min: 80000, max: 81699 }, // Colorado: 80000-81699
  "MN": { min: 55000, max: 56999 }, // Minnesota: 55000-56999
  "SC": { min: 29000, max: 29999 }, // South Carolina: 29000-29999
  "AL": { min: 35000, max: 36999 }, // Alabama: 35000-36999
  "LA": { min: 70000, max: 71999 }, // Louisiana: 70000-71999
  "KY": { min: 40000, max: 42999 }, // Kentucky: 40000-42999
  "OR": { min: 97000, max: 97999 }, // Oregon: 97000-97999
  "OK": { min: 73000, max: 74999 }, // Oklahoma: 73000-74999
  "CT": { min: 6000, max: 6999 },   // Connecticut: 06000-06999
  "UT": { min: 84000, max: 84799 }, // Utah: 84000-84799
  "IA": { min: 50000, max: 52999 }, // Iowa: 50000-52999
  "NV": { min: 89000, max: 89999 }, // Nevada: 89000-89999
  "AR": { min: 72000, max: 72999 }, // Arkansas: 72000-72999
  "MS": { min: 38600, max: 39799 }, // Mississippi: 38600-39799
  "KS": { min: 66000, max: 67999 }, // Kansas: 66000-67999
  "NM": { min: 87000, max: 88499 }, // New Mexico: 87000-88499
  "NE": { min: 68000, max: 69999 }, // Nebraska: 68000-69999
  "WV": { min: 25000, max: 26999 }, // West Virginia: 25000-26999
  "ID": { min: 83200, max: 83999 }, // Idaho: 83200-83999
  "HI": { min: 96800, max: 96999 }, // Hawaii: 96800-96999
  "NH": { min: 3000, max: 3899 },   // New Hampshire: 03000-03899
  "ME": { min: 3900, max: 4999 },   // Maine: 03900-04999
  "RI": { min: 2800, max: 2999 },   // Rhode Island: 02800-02999
  "MT": { min: 59000, max: 59999 }, // Montana: 59000-59999
  "DE": { min: 19700, max: 19999 }, // Delaware: 19700-19999
  "SD": { min: 57000, max: 57999 }, // South Dakota: 57000-57999
  "ND": { min: 58000, max: 58999 }, // North Dakota: 58000-58999
  "AK": { min: 99500, max: 99999 }, // Alaska: 99500-99999
  "DC": { min: 20000, max: 20599 }, // District of Columbia: 20000-20599
  "VT": { min: 5000, max: 5999 },   // Vermont: 05000-05999
  "WY": { min: 82000, max: 83199 }, // Wyoming: 82000-83199
};

// Known problematic zipcodes (common mistakes)
const PROBLEMATIC_ZIPCODES: Record<string, string[]> = {
  "TX": ["78943"], // Common typo for 78942
  // Add more as discovered
};

export interface ZipcodeValidationResult {
  isValid: boolean;
  isSuspicious: boolean;
  reason?: string;
  suggestedZipcode?: string;
}

export function validateZipcode(
  zipcode: string,
  stateCode: string
): ZipcodeValidationResult {
  if (!zipcode || !stateCode) {
    return { isValid: false, isSuspicious: false, reason: "Missing zipcode or state" };
  }

  // Parse zipcode (remove any non-numeric characters)
  const zipNum = parseInt(zipcode.replace(/\D/g, ""));
  
  if (isNaN(zipNum)) {
    return { isValid: false, isSuspicious: true, reason: "Invalid zipcode format" };
  }

  // Check if zipcode is in known problematic list
  const problematicList = PROBLEMATIC_ZIPCODES[stateCode] || [];
  if (problematicList.includes(zipcode)) {
    // Try to suggest correct zipcode (common pattern: off by 1)
    const suggestedZip = String(zipNum - 1);
    return {
      isValid: false,
      isSuspicious: true,
      reason: `Known problematic zipcode for ${stateCode}`,
      suggestedZipcode: suggestedZip,
    };
  }

  // Check if zipcode is in valid range for state
  const range = STATE_ZIPCODE_RANGES[stateCode];
  if (!range) {
    // State not in our mapping - can't validate
    return { isValid: true, isSuspicious: false };
  }

  if (zipNum < range.min || zipNum > range.max) {
    return {
      isValid: false,
      isSuspicious: true,
      reason: `Zipcode ${zipcode} not in valid range for ${stateCode} (${range.min}-${range.max})`,
    };
  }

  return { isValid: true, isSuspicious: false };
}

