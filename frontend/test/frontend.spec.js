import { test, expect } from '@playwright/test';
import { mockApi, customer, product } from './fixtures.js';

test('original storefront layout, search, size guide and mobile navigation',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await mockApi(page);await page.goto('/');
  await expect(page.locator('#productGrid .card')).toHaveCount(4);
  await expect(page.locator('.hero h1')).toHaveText('Prints with a past,cotton that breathes.');
  await expect(page.locator('#productGrid .add-btn').first()).toHaveText('Coming soon');
  await page.locator('#searchToggle').click();await page.locator('#searchInput').fill('jali');await expect(page.locator('#searchResults button')).toHaveCount(1);await page.locator('#searchResults button').click();
  if(await page.locator('#navToggle').isVisible())await page.locator('#navToggle').click();
  await page.locator('#sizeGuideLink').click();await expect(page.locator('#sizeGuideModal')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#sizeGuideModal')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('account forms and password-reset request keep the original modal design',async({page})=>{
  const {calls}=await mockApi(page);await page.goto('/');await page.locator('#accountToggle').click();
  await expect(page.locator('#signInForm')).toBeVisible();await page.locator('#authToggleBtn').click();await expect(page.locator('#signUpForm')).toBeVisible();await page.locator('#authToggleBtn').click();
  await page.locator('#forgotPasswordBtn').click();await expect(page.locator('#signInPasswordField')).toBeHidden();await page.locator('#signInEmail').fill(customer.email);await page.locator('#signInForm button[type="submit"]').click();await expect(page.locator('#signInError')).toContainText('instructions have been sent');
  expect(calls.find(call=>call.path==='/api/auth/password-reset').body).toEqual({email:customer.email});
});
test('React cart, coupon, guest shipping, checkout and invoice use backend responses',async({page})=>{
  const {calls}=await mockApi(page,{catalog:true});await page.goto('/');await page.locator('[data-product="'+product.id+'"] .size-chip').click();await page.locator('[data-product="'+product.id+'"] .add-btn').click();
  await expect(page.locator('#cartDrawer')).toHaveClass(/open/);await expect(page.locator('#cartCount')).toHaveText('1');await page.locator('[data-action="inc"]').click();await expect(page.locator('#cartCount')).toHaveText('2');
  await page.locator('#couponCode').fill('WELCOME');await page.locator('#applyCouponBtn').click();await expect(page.locator('#cartDiscount')).toContainText('200');
  await page.locator('#checkoutBtn').click();await expect(page.locator('#checkoutForm')).toBeVisible();
  for(const [key,value] of Object.entries(customer))if(value)await page.locator('#ship'+key[0].toUpperCase()+key.slice(1)).fill(value);
  await page.locator('#saveAddressBtn').click();await page.locator('#checkoutBtn').click();await expect(page.locator('#cartNote')).toContainText('Order saved');await expect(page.locator('#cartCount')).toHaveText('0');
  const call=calls.find(call=>call.path==='/api/checkout/orders');expect(call.body.items).toEqual([{id:product.id,size:'M',qty:2}]);expect(call.body.customer).toEqual(customer);expect(call.headers['idempotency-key']).toBeTruthy();
  const download=page.waitForEvent('download');await page.locator('#downloadInvoiceBtn').click();expect((await download).suggestedFilename()).toMatch(/algodon-invoice-.*\.pdf/);
});
test('customer login, private account, wishlist and logout',async({page})=>{
  const {calls}=await mockApi(page,{catalog:true});await page.goto('/');await page.locator('#accountToggle').click();await page.locator('#signInEmail').fill(customer.email);await page.locator('#signInPassword').fill('TestPassword123!');await page.locator('#signInForm button[type="submit"]').click();
  await expect(page.locator('#accountDrawer')).toBeHidden();await expect.poll(()=>calls.some(call=>call.path==='/api/account/me')).toBe(true);
  await page.getByRole('button',{name:'Save to wishlist',exact:true}).click();await expect(page.getByRole('button',{name:'Saved to wishlist'})).toBeVisible();
  expect(calls.find(call=>call.path.startsWith('/api/account/wishlist/')).headers.authorization).toMatch(/^Bearer /);
  await page.locator('#accountToggle').click();await page.locator('#navLogoutBtn').click();await expect(page.locator('#accountNavLabel')).toHaveText('Account');
});
test('newsletter sends a real API request and reports success',async({page})=>{
  const {calls}=await mockApi(page);await page.goto('/');await page.locator('#newsletterEmail').fill(customer.email);await page.locator('#newsletterSubmit').click();await expect(page.locator('#newsletterMsg')).toContainText('Thanks for subscribing');expect(calls.find(call=>call.path==='/api/newsletter').body.email).toBe(customer.email);
});
test('account deep links render React and remain usable before Render is connected',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await mockApi(page,{offline:true});
  for(const route of ['/orders/','/wishlist/','/account/']){await page.goto(route);await expect(page.locator('#accountDrawer')).toBeVisible();await expect(page.locator('.hero')).toBeVisible();}
  await page.locator('#signInEmail').fill(customer.email);await page.locator('#signInPassword').fill('TestPassword123!');await page.locator('#signInForm button[type="submit"]').click();await expect(page.locator('#signInError')).toContainText("aren't reachable");expect(errors).toEqual([]);
});
test('admin login route opens the normal customer sign-in',async({page})=>{
  await mockApi(page);await page.goto('/admin');await expect(page).toHaveURL(/\/account$/);await expect(page.locator('#accountDrawer')).toBeVisible();await expect(page.locator('#signInForm')).toBeVisible();await expect(page.locator('#loginForm')).toHaveCount(0);
});
test('admin product editor and all management screens use React and API actions',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));const {calls}=await mockApi(page,{signedAdmin:true,catalog:true});await page.goto('/admin');await page.locator('[data-page="products"]').click();await page.locator('#addProduct').click();await page.locator('#f-name').fill('New Cotton Shirt');await expect(page.locator('#f-slug')).toHaveValue('new-cotton-shirt');await page.locator('#f-price').fill('1900');await page.locator('#editForm button[type="submit"]').click();await expect(page.locator('#activeModal')).toHaveCount(0);expect(calls.some(call=>call.path==='/api/admin/products'&&call.method==='POST')).toBe(true);
  for(const name of ['categories','orders','coupons','customers','staff','activity']){await page.locator('[data-page="'+name+'"]').click();await expect(page.locator('.loading-screen')).toHaveCount(0);await expect(page.locator('.error')).toHaveCount(0);}
  await page.locator('[data-page="orders"]').click();await page.locator('[data-order]').first().click();await expect(page.locator('#activeModal')).toContainText('Order a0000000');await page.locator('#f-courier_name').fill('Test Courier');await page.locator('#editForm button[type="submit"]').click();await expect(page.locator('#activeModal')).toHaveCount(0);expect(errors).toEqual([]);
});
test('support permissions do not expose privileged management controls',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await mockApi(page,{signedAdmin:true,adminRole:'support',catalog:true});await page.goto('/admin');await expect(page.locator('.topbar h1')).toHaveText('Orders');await expect(page.locator('[data-page]')).toHaveCount(3);await expect(page.locator('#ordersExport')).toHaveCount(0);await page.locator('[data-page="products"]').click();await expect(page.locator('#addProduct')).toHaveCount(0);expect(errors).toEqual([]);
});

test('failed checkout preserves the cart and reuses its idempotency key on retry',async({page})=>{
  const {calls,state}=await mockApi(page,{catalog:true});state.checkoutFailures=1;
  await page.addInitScript(address=>localStorage.setItem('algodon_demo_address',JSON.stringify(address)),customer);
  await page.goto('/');await page.locator('[data-product="'+product.id+'"] .size-chip').click();await page.locator('[data-product="'+product.id+'"] .add-btn').click();
  await page.locator('#checkoutBtn').click();await expect(page.locator('#cartNote')).toContainText('could not be saved');await expect(page.locator('#cartCount')).toHaveText('1');await expect(page.locator('#downloadInvoiceBtn')).toBeHidden();
  await page.locator('#checkoutBtn').click();await expect(page.locator('#cartNote')).toContainText('Order saved');
  const requests=calls.filter(call=>call.path==='/api/checkout/orders');expect(requests).toHaveLength(2);expect(requests[0].headers['idempotency-key']).toBe(requests[1].headers['idempotency-key']);
});

test('signup and authenticated orders and wishlist survive page navigation',async({page})=>{
  const {calls}=await mockApi(page,{catalog:true});await page.goto('/');await page.locator('#accountToggle').click();await page.locator('#authToggleBtn').click();await page.locator('#signUpName').fill(customer.name);await page.locator('#signUpEmail').fill(customer.email);await page.locator('#signUpPassword').fill('TestPassword123!');await page.locator('#signUpForm button[type="submit"]').click();await expect(page.locator('#accountDrawer')).toBeHidden();
  expect(calls.find(call=>call.path==='/api/auth/signup').body).toEqual({name:customer.name,email:customer.email,password:'TestPassword123!'});
  await page.getByRole('button',{name:'Save to wishlist',exact:true}).click();await expect(page.getByRole('button',{name:'Saved to wishlist'})).toBeVisible();
  await page.goto('/orders/');await expect(page.locator('.order-card')).toHaveCount(1);await expect(page.locator('.order-id')).toContainText('a0000000');
  await page.goto('/wishlist/');await expect(page.locator('#accountRouteContent')).toContainText(product.name);await page.locator('#accountRouteContent').getByRole('button',{name:'Remove'}).click();await expect(page.locator('#accountRouteContent')).toContainText('Your wishlist is empty.');
});

test('password recovery verifies matching passwords and updates through the backend',async({page})=>{
  const {session,calls}=await mockApi(page);
  const hash=new URLSearchParams({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:'3600',token_type:'bearer',type:'recovery'});
  await page.goto('/account#'+hash);await expect(page.locator('#recoveryForm')).toBeVisible();await page.locator('#recoveryPassword').fill('AnotherPassword123!');await page.locator('#recoveryConfirm').fill('DifferentPassword123!');await page.locator('#recoveryForm button[type="submit"]').click();await expect(page.locator('#recoveryError')).toContainText('Passwords must match');
  await page.locator('#recoveryConfirm').fill('AnotherPassword123!');await page.locator('#recoveryForm button[type="submit"]').click();await expect(page.locator('#signInError')).toContainText('Password updated');expect(calls.find(call=>call.path==='/api/auth/password-update').body).toEqual({password:'AnotherPassword123!'});
});
