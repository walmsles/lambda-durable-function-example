export interface Customer {
  customer_id: string;
  name: string;
  email: string;
  ssn: string;
  address: string;
}

export interface Payment {
  method: string;
  creditCard: string;
  amount: number;
}

export interface OrderItem {
  id: string;
  quantity: number;
}

export interface OrderInput {
  customer: Customer;
  payment: Payment;
  items: OrderItem[];
}

export interface Order {
  id: string;
  customerId: string;
  customer: Customer;
  payment: Payment;
  items: OrderItem[];
  createdAt: string;
}
