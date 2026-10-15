export const product={id:'a0000000-0000-4000-8000-000000000001',name:'Golden-Brown Swirl',slug:'golden-brown-swirl',brand:'Algodon',price:1900,stock_count:10,published:true,images:['/img/product-golden-brown.jpg'],variants:[{size:'M',stock:10}],tags:[]};
export const customer={name:'Test Customer',email:'customer@example.com',phone:'9876543210',address1:'12 Cotton Street',address2:'',city:'Chennai',state:'Tamil Nadu',pin:'600001'};
export const order={id:'a0000000-0000-4000-8000-000000000002',created_at:'2026-10-15T09:00:00Z',status:'Pending',payment_status:'Pending',customer,items:[{id:product.id,name:product.name,size:'M',qty:1,price:1900}],subtotal:1900,discount:0};
export const user={id:'a0000000-0000-4000-8000-000000000003',email:customer.email,role:'authenticated',aud:'authenticated',user_metadata:{full_name:customer.name}};
export const admin={id:'a0000000-0000-4000-8000-000000000004',email:'admin@example.com',role:'super_admin'};

export async function mockApi(page,{catalog=false,signedAdmin=false,adminRole='super_admin',offline=false}={}){
  const calls=[],state={signedAdmin,cart:[],wishlist:[],checkoutFailures:0};
  const session={access_token:Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),aud:'authenticated',role:'authenticated'})).toString('base64url')+'.test-signature',refresh_token:'test-refresh-token',expires_in:3600,token_type:'bearer',user};
  await page.route('https://example.supabase.co/**',route=>route.fulfill({json:route.request().url().includes('/user')?user:{...session}}));
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
    let body;try{body=req.postDataJSON();}catch{}
    calls.push({path,method,body,headers:req.headers()});
    const reply=(json,status=200)=>route.fulfill({status,json});
    if(offline)return reply({error:'The backend is not connected yet. Please try again later.'},503);
    if(path==='/api/config')return reply({supabase:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test_public_key'},firebaseEnabled:false});
    if(path==='/api/products')return reply({data:catalog?[product]:[]});
    if(path==='/api/auth/login'||path==='/api/auth/signup')return reply({user,session});
    if(path==='/api/auth/password-reset')return reply({message:'If this account exists, password reset instructions have been sent.'});
    if(path==='/api/auth/logout'||path==='/api/auth/password-update')return reply({ok:true});
    if(path==='/api/account/cart'){
      if(method==='PUT')state.cart=body.items.map(item=>({...item,name:product.name,price:product.price,img:product.images[0]}));
      return reply(method==='GET'?{data:state.cart}:{ok:true});
    }
    if(path==='/api/account/me')return reply({data:{email:user.email,full_name:customer.name,phone:customer.phone,addresses:[]}});
    if(path==='/api/account/orders')return reply({data:[order],total:1});
    if(path==='/api/account/wishlist')return reply({data:state.wishlist});
    if(path.startsWith('/api/account/wishlist/')){state.wishlist=method==='PUT'?[{product_id:product.id,product}]:[];return reply({ok:true});}
    if(path==='/api/checkout/orders'){
      if(state.checkoutFailures>0){state.checkoutFailures--;return reply({error:'The order could not be saved. Please try again.'},503);}
      return reply({data:{...order,items:body.items.map(item=>({...item,name:product.name,price:1900})),customer:body.customer,subtotal:body.items.reduce((total,item)=>total+item.qty*1900,0)}},201);
    }
    if(path==='/api/coupons/validate')return reply({valid:true,code:'WELCOME',type:'flat',discount:200});
    if(path==='/api/newsletter')return reply({message:'Saved.'},202);
    if(path==='/api/admin/auth/login'){state.signedAdmin=true;return reply({user:{...admin,role:adminRole}});}
    if(path==='/api/admin/auth/logout'){state.signedAdmin=false;return reply({ok:true});}
    if(path==='/api/admin/auth/password-reset')return reply({message:'If that admin account exists, password reset instructions have been sent.'});
    if(path==='/api/admin/me')return state.signedAdmin?reply({user:{...admin,role:adminRole}}):reply({error:'Sign in to continue.'},401);
    if(path==='/api/admin/dashboard')return reply({kpis:{revenue:1900,orders:1,averageOrderValue:1900,newCustomers:1,repeatCustomerRate:0},revenueByDay:[{date:'2026-10-15',amount:1900}],ordersByStatus:{Pending:1},lowStock:[],topProducts:[],salesByCategory:[]});
    if(path==='/api/admin/categories')return reply({data:[]});
    if(path==='/api/admin/orders/'+order.id)return reply({data:order});
    if(method==='GET'&&path==='/api/admin/orders')return reply({data:[order],total:1,page:1,limit:25});
    if(method==='GET'&&path==='/api/admin/products')return reply({data:catalog?[product]:[],total:catalog?1:0,page:1,limit:25});
    if(path==='/api/admin/staff')return reply({data:[{...admin,user_id:admin.id,created_at:order.created_at}]});
    if(path==='/api/admin/coupons'||path==='/api/admin/customers'||path==='/api/admin/activity')return reply({data:[],total:0,page:1,limit:25});
    if(method!=='GET')return reply({ok:true,data:body});
    return reply({data:[],total:0,page:1,limit:25});
  });
  return {calls,state,user,session};
}
