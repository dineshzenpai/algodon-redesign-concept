export const demoAdminUser = {
  id: 'a0000000-0000-4000-8000-000000000004',
  email: 'admin@example.com',
  role: 'super_admin'
};

export const demoDashboard = {
  kpis: {
    revenue: 247000,
    orders: 130,
    averageOrderValue: 1900,
    newCustomers: 85,
    repeatCustomerRate: 0.35
  },
  revenueByDay: [
    { date: '2026-10-20', amount: 11400 },
    { date: '2026-10-21', amount: 15200 },
    { date: '2026-10-22', amount: 19000 },
    { date: '2026-10-23', amount: 13300 },
    { date: '2026-10-24', amount: 22800 },
    { date: '2026-10-25', amount: 30400 },
    { date: '2026-10-26', amount: 19000 },
    { date: '2026-10-27', amount: 24700 },
    { date: '2026-10-28', amount: 17100 },
    { date: '2026-10-29', amount: 28500 },
    { date: '2026-10-30', amount: 34200 },
    { date: '2026-10-31', amount: 26600 },
    { date: '2026-11-01', amount: 38000 },
    { date: '2026-11-02', amount: 41800 }
  ],
  ordersByStatus: { Confirmed: 24, Packed: 18, Shipped: 42, Delivered: 40, Pending: 6 },
  topProducts: [
    { id: '1', name: 'Golden-Brown Swirl', quantity: 48 },
    { id: '2', name: 'Rajasthan Jali', quantity: 36 },
    { id: '3', name: 'Rangeen Pakshee', quantity: 28 },
    { id: '4', name: 'Kamal Ka Phool', quantity: 18 }
  ],
  salesByCategory: [
    { id: 'c1', name: 'Hand Block Prints', amount: 152000 },
    { id: 'c2', name: 'Organic Cotton Solids', amount: 95000 }
  ],
  lowStock: [
    { id: '1', name: 'Kamal Ka Phool (Size L)', stock_count: 2 },
    { id: '2', name: 'Rajasthan Jali (Size S)', stock_count: 3 }
  ]
};

export const demoProducts = [
  { id: 'a0000000-0000-4000-8000-000000000001', name: 'Golden-Brown Swirl', slug: 'golden-brown-swirl', price: 1900, sale_price: null, stock_count: 45, low_stock_threshold: 5, published: true, brand: 'Algodon', tags: ['Organic', 'Swirl'], variants: [{ size: 'S', stock: 15 }, { size: 'M', stock: 20 }, { size: 'L', stock: 10 }], images: ['/img/product-golden-brown.jpg'] },
  { id: 'a0000000-0000-4000-8000-000000000002', name: 'Rajasthan Jali', slug: 'rajasthan-jali', price: 1900, sale_price: null, stock_count: 32, low_stock_threshold: 5, published: true, brand: 'Algodon', tags: ['Block-print'], variants: [{ size: 'S', stock: 10 }, { size: 'M', stock: 12 }, { size: 'L', stock: 10 }], images: ['/img/product-jali.jpg'] },
  { id: 'a0000000-0000-4000-8000-000000000003', name: 'Rangeen Pakshee', slug: 'rangeen-pakshee', price: 4400, sale_price: 1900, stock_count: 28, low_stock_threshold: 5, published: true, brand: 'Algodon', tags: ['Sale'], variants: [{ size: 'S', stock: 8 }, { size: 'M', stock: 10 }, { size: 'L', stock: 10 }], images: ['/img/product-pakshee.jpg'] },
  { id: 'a0000000-0000-4000-8000-000000000004', name: 'Kamal Ka Phool', slug: 'kamal-ka-phool', price: 8200, sale_price: 1900, stock_count: 14, low_stock_threshold: 5, published: true, brand: 'Algodon', tags: ['Sale', 'Lotus'], variants: [{ size: 'S', stock: 4 }, { size: 'M', stock: 6 }, { size: 'L', stock: 4 }], images: ['/img/product-kamal.jpg'] }
];

export const demoCategories = [
  { id: 'c0000000-0000-4000-8000-000000000001', name: 'Shirts', slug: 'shirts', description: 'Organic cotton handcrafted shirts', active: true, sort_order: 1 },
  { id: 'c0000000-0000-4000-8000-000000000002', name: 'Hand Block Prints', slug: 'hand-block-prints', description: 'Artisanal hand block printed designs', active: true, sort_order: 2 }
];

export const demoOrders = [
  { id: 'ord-2026-1001', created_at: '2026-11-02T10:15:00Z', status: 'Shipped', subtotal: 3800, discount: 200, customer: { name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543210', city: 'Mumbai', state: 'Maharashtra', pin: '400001' }, items: [{ name: 'Golden-Brown Swirl', size: 'M', qty: 2, price: 1900 }] },
  { id: 'ord-2026-1002', created_at: '2026-11-02T14:30:00Z', status: 'Confirmed', subtotal: 1900, discount: 0, customer: { name: 'Rahul Verma', email: 'rahul@example.com', phone: '9812345678', city: 'Bengaluru', state: 'Karnataka', pin: '560001' }, items: [{ name: 'Rajasthan Jali', size: 'L', qty: 1, price: 1900 }] },
  { id: 'ord-2026-1003', created_at: '2026-11-01T18:00:00Z', status: 'Delivered', subtotal: 5700, discount: 500, customer: { name: 'Ananya Iyer', email: 'ananya@example.com', phone: '9845012345', city: 'Chennai', state: 'Tamil Nadu', pin: '600002' }, items: [{ name: 'Rangeen Pakshee', size: 'S', qty: 1, price: 1900 }, { name: 'Kamal Ka Phool', size: 'M', qty: 2, price: 1900 }] }
];

export const demoCoupons = [
  { id: 'cpn-001', code: 'WELCOME10', type: 'percentage', value: 10, minimum_order: 1500, active: true },
  { id: 'cpn-002', code: 'ORGANIC200', type: 'flat', value: 200, minimum_order: 1900, active: true }
];

export const demoCustomers = [
  { email: 'priya@example.com', name: 'Priya Sharma', order_count: 3, total_spent: 7600, blocked: false },
  { email: 'rahul@example.com', name: 'Rahul Verma', order_count: 1, total_spent: 1900, blocked: false },
  { email: 'ananya@example.com', name: 'Ananya Iyer', order_count: 2, total_spent: 5700, blocked: false }
];

export const demoStaff = [
  { user_id: 'a0000000-0000-4000-8000-000000000004', email: 'admin@example.com', role: 'super_admin', created_at: '2026-10-01T00:00:00Z' },
  { user_id: 'a0000000-0000-4000-8000-000000000005', email: 'support@algodon.store', role: 'support', created_at: '2026-10-15T00:00:00Z' }
];

export const demoActivity = [
  { id: 'act-1', actor_email: 'admin@example.com', action: 'admin.login', entity_type: 'admin', created_at: new Date().toISOString(), details: { role: 'super_admin' } },
  { id: 'act-2', actor_email: 'admin@example.com', action: 'product.update', entity_type: 'product', created_at: new Date(Date.now() - 3600000).toISOString(), details: { fields: ['price', 'stock'] } }
];
