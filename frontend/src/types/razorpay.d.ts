// The Razorpay Checkout script (checkout.razorpay.com/v1/checkout.js) adds window.Razorpay.
// Only the parts this app uses are typed here.

interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key?: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>;
  prefill?: { name?: string | null; email?: string | null; contact?: string | null };
  theme?: { color?: string };
  // ondismiss runs when the buyer closes the window without paying.
  modal?: { ondismiss?: () => void };
}

interface RazorpayCheckout {
  open(): void;
}

interface Window {
  Razorpay: new (options: RazorpayOptions) => RazorpayCheckout;
}
