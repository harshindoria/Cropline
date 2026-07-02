import Razorpay from 'razorpay';
import crypto from 'crypto';

// ============================================================================
// 🛠️ RAZORPAY INITIALIZATION
// Ensure your .env file has RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
// ============================================================================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

/**
 * 1. CREATE RAZORPAY ORDER (For Buyers)
 * Jab buyer "Pay Now" karta hai, toh yeh function call hoga.
 * Razorpay hamesha amount "Paise" mein leta hai, isliye hum * 100 karte hain.
 * 
 * @param amountInINR - Amount in Rupees (e.g., 500)
 * @param receiptId - Hamare system ka Order ID (e.g., 'ord_123')
 * @param notes - Extra data (optional) jo webhook mein wapas aayega
 */
export const createRazorpayOrder = async (
  amountInINR: number,
  receiptId: string,
  notes: Record<string, string> = {}
) => {
  try {
    const options = {
      amount: Math.round(amountInINR * 100), // Convert ₹ to Paise
      currency: 'INR',
      receipt: receiptId,
      notes: notes,
    };

    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Error in createRazorpayOrder:', error);
    throw new Error('Failed to create Razorpay Order');
  }
};

/**
 * 2. CREATE PAYMENT LINK (For Delivery Boy Settlement)
 * Jab Delivery Boy par cash liability badh jati hai, toh usay pay karne ke liye 
 * yeh ek URL banayega jo wo apni app se click karke pay kar sakta hai.
 * 
 * @param amountInINR - Amount driver owes (e.g., 10000)
 * @param referenceId - Driver ID ya Settlement ID
 * @param driverDetails - Delivery boy ka naam aur contact (SMS alert ke liye)
 */
export const createRazorpayPaymentLink = async (
  amountInINR: number,
  referenceId: string,
  driverDetails: { name: string; contact: string; email?: string }
) => {
  try {
    const options = {
      amount: Math.round(amountInINR * 100),
      currency: 'INR',
      accept_partial: false,
      reference_id: referenceId,
      description: 'KhetSe Platform - Cash Liability Settlement',
      customer: {
        name: driverDetails.name,
        contact: driverDetails.contact,
        email: driverDetails.email || '',
      },
      notify: {
        sms: true,
        email: false,
      },
      reminder_enable: true,
    };

    const paymentLink = await razorpay.paymentLink.create(options);
    return paymentLink; 
    // Isme humein paymentLink.short_url aur paymentLink.id milega
  } catch (error) {
    console.error('Error in createRazorpayPaymentLink:', error);
    throw new Error('Failed to create Settlement Link');
  }
};

/**
 * 3. VERIFY WEBHOOK SIGNATURE (The Security Guard)
 * Yeh function check karega ki request sach mein Razorpay se aayi hai ya kisi hacker se.
 * 
 * @param rawBody - Express ki raw string body (JSON parsed nahi, strictly string chahiye)
 * @param signature - 'x-razorpay-signature' jo request header mein aayega
 * @param secret - Hamara Razorpay Webhook Secret (from .env)
 */
export const verifyRazorpayWebhookSignature = (
  rawBody: string,
  signature: string,
  secret: string
): boolean => {
  try {
    // HMAC SHA256 algorithm ka use karke apne secret se lock banate hain
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Agar hamara banaya lock aur Razorpay ka bheja lock match ho gaya, toh request real hai
    return expectedSignature === signature;
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
};

/**
 * 4. FETCH PAYMENT STATUS (The Double Checker)
 * Agar webhook miss ho jaye (network issue), toh hum manual cron job se 
 * is function ke zariye payment ka saccha status pooch sakte hain.
 * 
 * @param paymentId - Razorpay ka 'pay_xxxx' ID
 */
export const fetchRazorpayPaymentStatus = async (paymentId: string) => {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment; 
    // payment.status mein humein 'captured', 'failed', 'authorized' aadi milega
  } catch (error) {
    console.error('Error fetching Razorpay payment status:', error);
    throw new Error('Failed to fetch payment status');
  }
};

/**
 * 5. CANCEL EXPIRED PAYMENT LINK (Cleanup Task)
 * Agar delivery boy ne settlement link generate kiya par pay nahi kiya, 
 * toh usey system se clean/cancel karne ke liye.
 * 
 * @param linkId - Payment link ID ('plink_xxxx')
 */
export const cancelExpiredPaymentLink = async (linkId: string) => {
  try {
    const response = await razorpay.paymentLink.cancel(linkId);
    return response;
  } catch (error) {
    console.error('Error cancelling payment link:', error);
    throw new Error('Failed to cancel payment link');
  }
};