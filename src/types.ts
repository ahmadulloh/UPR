export enum Page {
  Home = 'home',
  Sotuv = 'sotuv',
  Xarid = 'xarid',
  Kassa = 'kassa',
  Xarajatlar = 'xarajatlar',
  Hisobot = 'hisobot',
  MaLumotlar = 'malumotlar',
  SotuvYangi = 'sotuv-yangi',
  XaridYangi = 'xarid-yangi',
}

export type Unit = 'kg' | 'dona' | 'litr' | 'metr' | 'm2' | 'tonna' | 'qop' | 'blok' | 'pachka' | 'karobka' | 'komplekt';

export type KassaTur = 'kirim' | 'chiqim';

export interface KassaTransaction {
  id: string;
  sana: string;
  tur: KassaTur;
  nomi: string; // Kirimda "To'lov nomi", Chiqimda "Oluvchi nomi"
  summa: number;
  izoh?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Product {
  id: string;
  nomi: string;
  olchov: Unit;
  sotishNarxi: number;
  xaridNarxi: number;
  qoldiq: number;
}

export type KontragentTur = 'xaridor' | 'yetkazuvchi' | 'boshqa';

export interface Kontragent {
  id: string;
  nomi: string;
  tur: KontragentTur;
  tel?: string;
  tel2?: string;
  manzil?: string;
}

export interface DocRow {
  id: string;
  productId: string;
  miqdor: number;
  narx: number;
  xaridNarxi?: number;
}

export type DocStatus = 'qisman' | 'toliq' | 'tolanmagan';

export interface SaleDoc {
  id: string;
  raqam: string;
  sana: string;
  kontragentId: string;
  holat: DocStatus;
  ombor: string;
  rows: DocRow[];
  summa: number;
  jami: number;
  izoh?: string;
  tolovMuddati?: string;
  tolanganSumma?: number;
}

export interface PurchaseDoc {
  id: string;
  raqam: string;
  sana: string;
  kontragentId: string;
  holat: DocStatus;
  ombor: string;
  rows: DocRow[];
  summa: number;
  jami: number;
  izoh?: string;
  tulovHolati?: 'tolandi' | 'tolanmadi';
  tulovMuddati?: string;
}

export interface Expense {
  id: string;
  nomi: string;
  sana: string;
  summa: number;
  kategoriya: string;
  izoh?: string;
}
