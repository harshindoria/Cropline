// Shapes of the data the backend sends. Dates arrive as ISO strings.

// Prisma Decimal columns (prices, quantities, money) arrive as strings in JSON.
// Wrap them in Number() before doing arithmetic, so "+" adds instead of joining text.
export type Decimal = string | number;

export type CropCategory = "VEGETABLES" | "FRUITS" | "GRAINS" | "HERBS" | "DAIRY" | "PULSES" | "OILSEEDS" | "OTHER";
export type CropStatus = "ACTIVE" | "PAUSED" | "CLOSED";

export type CatalogItem = {
  id: string;
  englishName: string;
  hindiName: string;
  category: CropCategory;
  imageTemplate: string | null;
  isActive: boolean;
  // Average price of active listings, only on GET /crops/catalog.
  marketPrice?: number | null;
};

export type CropOffer = {
  minQuantityKg: Decimal;
  discountPercentage: Decimal;
};

export type Crop = {
  id: string;
  farmerId: string;
  catalogId: string;
  catalog?: CatalogItem;
  description: string | null;
  quantityKg: Decimal;
  quantityRemainingKg: Decimal;
  basePricePerKg: Decimal;
  minOrderKg: Decimal;
  harvestDate: string;
  photos: string[];
  farmLatitude: number;
  farmLongitude: number;
  farmVillage: string;
  farmDistrict: string;
  farmState: string;
  selfPickupEnabled: boolean;
  isPreHarvest: boolean;
  status: CropStatus;
  viewsCount: number;
  createdAt: string;
  offer?: CropOffer | null;
};

// Anything a crop's display name can be read from: a listing, or the crop inside an order.
export type CropNameSource = {
  cropName?: string;
  catalog?: { englishName: string; hindiName: string } | null;
};

// A crop as buyers get it from the server: their price per kg, never the farmer's.
export type BuyerCrop = Omit<Crop, "basePricePerKg"> & { buyerPricePerKg: number };

// A crop in the buyer's marketplace (GET /crops).
export type CropListing = BuyerCrop & {
  farmer?: {
    id: string;
    name: string | null;
    village: string | null;
    district: string | null;
    rating: number;
    ratingCount: number;
    isVerified: boolean;
  };
  cropName: string;
  hindiName: string;
  category: CropCategory;
  marketPrice: number | null;
  freshnessDays: number;
};

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "READY_FOR_PICKUP"
  | "DELIVERY_SEARCHING"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export type PersonSummary = { id: string; name: string | null; phone?: string };

export type DeliveryJob = {
  id: string;
  orderId: string;
  deliveryPartnerId: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropLatitude: number;
  dropLongitude: number;
  distanceKm: number;
  cropWeightKg: Decimal;
  status: string;
  liveLatitude: number | null;
  liveLongitude: number | null;
  liveLocationUpdatedAt: string | null;
  pickupPhoto: string | null;
  deliveryPhoto: string | null;
  acceptedAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  estimatedDeliveryAt: string | null;
  createdAt: string;
  // GET /orders/:id also sends the partner's vehicle.
  deliveryPartner?: PersonSummary & { vehicleType?: string | null };
};

export type PaymentRecord = {
  id: string;
  provider: string;
  status: string;
  amount: Decimal;
  capturedAt: string | null;
  refundedAt: string | null;
};

// An order as GET /orders and GET /orders/:id send it.
export type Order = {
  id: string;
  cropId: string;
  farmerId: string;
  buyerId: string;
  quantityKg: Decimal;
  // Sent to the farmer only. The buyer never gets the farmer's price or the platform's cut.
  basePricePerKg?: Decimal;
  farmerEarnings?: Decimal;
  cropMarkupRate?: Decimal;
  platformFee?: Decimal;
  deliveryPlatformFee?: Decimal;
  deliveryPartnerPayout?: Decimal;
  // Sent to the buyer only: what they pay per kg.
  pricePerKg?: number;
  deliveryFee: Decimal;
  // The farmer gets the discount on their price; the buyer gets it in buyer prices.
  discountAmount: Decimal;
  totalBuyerPrice: Decimal;
  deliveryType: "DELIVERY" | "SELF_PICKUP";
  paymentType: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  deliveryAddress: string | null;
  deliveryDate: string | null;
  status: OrderStatus;
  cancellationReason: string | null;
  farmerAcceptedAt: string | null;
  dispatchStartedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  crop?: Crop;
  farmer?: PersonSummary & {
    village?: string | null;
    district?: string | null;
    rating?: number;
    ratingCount?: number;
    isVerified?: boolean;
  };
  buyer?: PersonSummary & { village?: string | null; district?: string | null };
  paymentRecord?: PaymentRecord | null;
  deliveryJob?: DeliveryJob | null;
  // Each code is only sent to the person who needs it; everyone else gets null.
  pickupOtp?: string | null;
  deliveryOtp?: string | null;
};

export type Review = {
  id: string;
  orderId: string;
  reviewerId: string;
  targetId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer?: { id: string; name: string | null };
  order?: { crop?: { id?: string; catalog?: CatalogItem | null } | null } | null;
};

// GET /reviews/me
export type MyReviews = {
  averageRating: number;
  totalCount: number;
  distribution: Record<number, number>;
  textReviews: Review[];
};

// GET /users/farmer/:id/public
export type FarmerPublicProfile = {
  id: string;
  name: string | null;
  village: string | null;
  district: string | null;
  state: string | null;
  aboutMe: string | null;
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  createdAt: string;
  farmArea: number | null;
  primaryCrops: string;
  farmingType: string | null;
  soilType: string | null;
  waterSource: string | null;
  activeCrops: BuyerCrop[];
  reviews: {
    distribution: Record<number, number>;
    totalCount: number;
    textReviews: Review[];
  };
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

// A job a delivery partner can accept (GET /delivery/nearby, inside data.jobs).
export type NearbyJob = {
  orderId: string;
  cropName: string;
  cropPhoto: string | null;
  farmLocation: { village: string; district: string; state: string; latitude: number; longitude: number };
  dropAddress: string | null;
  weightKg: number;
  pickupDistanceKm: number;
  totalDistanceKm: number;
  estimatedFee: number;
  estimatedTimeMins: number;
  farmerName: string | null;
  expiresAt: string | null;
};

// A job the delivery partner has accepted (GET /delivery/jobs/active).
export type ActiveJob = {
  jobId: string;
  orderId: string;
  status: string;
  cropName: string;
  weightKg: number;
  estimatedFee: Decimal;
  paymentType: string;
  paymentStatus: string;
  totalBuyerPrice: Decimal;
  pickupLocation: { latitude: number; longitude: number; village: string; district: string; state: string };
  dropLocation: { latitude: number; longitude: number; address: string | null };
  farmer: { id: string; name: string | null };
  buyer: { id: string; name: string | null; phone: string };
  estimatedDeliveryAt: string | null;
  acceptedAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  distanceKm: number;
};

// Cash a delivery partner collected and still owes the platform.
export type CashLiability = {
  id: string;
  orderId: string;
  amount: Decimal;
  status: string;
  createdAt: string;
  order: Order;
};

export type SettlementSummary = {
  totalPendingAmount: number;
  totalPendingOrders: number;
  liabilities: CashLiability[];
};

// The signed-in user's full account, as the /users/profile endpoints send it.
export type AccountProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string;
  roles: string[];
  activeRole: string;
  aboutMe: string | null;
  dob: string | null;
  gender: string | null;
  languagePref: string | null;
  latitude: number | null;
  longitude: number | null;
  village: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  walletBalance: Decimal;
  rating: number;
  ratingCount: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  farmArea: number | null;
  primaryCrops: string | null;
  farmingType: string | null;
  soilType: string | null;
  waterSource: string | null;
  vehicleType: string | null;
  vehicleNumber: string | null;
  vehicleColor: string | null;
  coverageRadiusKm: number | null;
  isOnline: boolean;
  bankIfsc: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  aadhaarLast4: string | null;
  aadhaarVerified: boolean;
  dlVerified: boolean;
  rcVerified: boolean;
  // Stored encrypted and never sent back; the screens still read these, so they are always empty.
  bankAccount?: string | null;
  aadhaarUrl?: string | null;
  dlUrl?: string | null;
  rcUrl?: string | null;
};

// Sent over the socket when an order changes, e.g. "order:assigned".
export type OrderSocketEvent = {
  orderId: string;
  message?: string;
};

// One crop's page (GET /crops/:id).
export type CropDetail = BuyerCrop & {
  farmer?: {
    id: string;
    name: string | null;
    village: string | null;
    district: string | null;
    state: string | null;
    rating: number;
    ratingCount: number;
    isVerified: boolean;
    createdAt: string;
  };
  cropName: string;
  hindiName: string;
  marketPrice: number | null;
};

// A crop in the farmer's own list (GET /crops/farmer/mine).
export type FarmerCrop = Crop & {
  buyerPricePerKg: number | null;
  cropName: string;
  hindiName: string;
  marketPrice: number | null;
  freshnessDays: number;
  _count?: { orders: number };
};
