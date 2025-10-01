import { UserAddress } from "@ts-types/generated";
function removeFalsy(obj: any) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => Boolean(v)));
}

export function formatAddress(address: UserAddress) {
  if (!address) return;
  
  // Handle shipping address fields
  const addressParts = [];
  
  // Add address line 1
  if ((address as any).shipping_address1) {
    addressParts.push((address as any).shipping_address1);
  }
  
  // Add address line 2 if exists
  if ((address as any).shipping_address2) {
    addressParts.push((address as any).shipping_address2);
  }
  
  // Add city
  if ((address as any).shipping_city) {
    addressParts.push((address as any).shipping_city);
  }
  
  // Add province/state code and zipcode together
  const stateZip = [];
  if ((address as any).shipping_province_code) {
    stateZip.push((address as any).shipping_province_code);
  }
  if ((address as any).shipping_zipcode) {
    stateZip.push((address as any).shipping_zipcode);
  }
  if (stateZip.length > 0) {
    addressParts.push(stateZip.join(' '));
  }
  
  // Always add "United States" at the end for US addresses
  addressParts.push('United States');
  
  return addressParts.join(', ');
}
