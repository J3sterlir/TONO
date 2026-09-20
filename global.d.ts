declare module 'select-philippines-address' {
  export function regions(): Promise<any[]>
  export function provinces(regionCode: string): Promise<any[]>
  export function cities(provinceCode: string): Promise<any[]>
  export function barangays(cityCode: string): Promise<any[]>
}