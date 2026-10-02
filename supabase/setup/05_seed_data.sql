-- 05: Idempotent demo catalog for Algodon Organic (India; INR).
insert into public.categories(name,slug,description,sort_order,is_active) values
 ('Shirts','shirts','Everyday and tailored menswear shirts.',1,true),
 ('T-Shirts','t-shirts','Essential cotton and jersey tees.',2,true),
 ('Jeans & Trousers','jeans-trousers','Denim and tailored trousers.',3,true),
 ('Suits','suits','Occasion and formal suiting.',4,true),
 ('Kurtas','kurtas','Contemporary ethnic menswear.',5,true),
 ('Jackets','jackets','Layering pieces and outerwear.',6,true)
on conflict (slug) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,is_active=excluded.is_active;

insert into public.products(category_id,name,slug,description,price,fit,fabric,occasion,care_instructions,size_chart,is_active)
select c.id,p.name,p.slug,p.description,p.price,p.fit,p.fabric,p.occasion,p.care,'{"sizes":["S","M","L","XL","XXL"]}'::jsonb,true
from (values
 ('shirts','Everyday Oxford Shirt','everyday-oxford-shirt','A crisp, versatile cotton Oxford with a soft washed finish.',2499::numeric(10,2),'regular','100% cotton Oxford','{casual,formal}'::text[],'Machine wash cold with similar colours.'),
 ('shirts','Linen Band-Collar Shirt','linen-band-collar-shirt','A breathable linen shirt with a clean band collar.',2899::numeric(10,2),'relaxed','Linen-cotton blend','{casual,ethnic}'::text[],'Gentle wash; line dry.'),
 ('t-shirts','Heavyweight Crew T-Shirt','heavyweight-crew-t-shirt','A substantial everyday jersey tee with a structured hand feel.',1299::numeric(10,2),'regular','240 GSM organic cotton jersey','{casual}'::text[],'Wash inside out in cold water.'),
 ('t-shirts','Relaxed Pocket T-Shirt','relaxed-pocket-t-shirt','A relaxed-fit tee finished with a tonal chest pocket.',1499::numeric(10,2),'relaxed','Organic cotton slub jersey','{casual}'::text[],'Gentle machine wash; do not bleach.'),
 ('jeans-trousers','Straight-Leg Indigo Jeans','straight-leg-indigo-jeans','Mid-rise denim with a classic straight leg.',3299::numeric(10,2),'regular','12 oz cotton denim','{casual}'::text[],'Wash sparingly inside out.'),
 ('jeans-trousers','Slim Chino Trousers','slim-chino-trousers','A refined stretch chino for workdays and weekends.',2799::numeric(10,2),'slim','Cotton twill with 2% elastane','{casual,formal}'::text[],'Machine wash cold; low iron.'),
 ('suits','Two-Piece Textured Suit','two-piece-textured-suit','A versatile two-piece suit in a breathable textured weave.',11999::numeric(10,2),'slim','Wool blend suiting','{formal,party}'::text[],'Professional dry clean only.'),
 ('suits','Unstructured Cotton Blazer','unstructured-cotton-blazer','An easy, unlined blazer for smart-casual occasions.',6999::numeric(10,2),'regular','Cotton-linen canvas','{formal,party}'::text[],'Professional dry clean recommended.'),
 ('kurtas','Classic Cotton Kurta','classic-cotton-kurta','A clean straight kurta designed for festive and everyday wear.',2199::numeric(10,2),'regular','100% cotton voile','{ethnic,party}'::text[],'Gentle wash separately.'),
 ('kurtas','Textured Festive Kurta','textured-festive-kurta','A textured kurta with understated detailing for celebrations.',3499::numeric(10,2),'regular','Cotton silk blend','{ethnic,party}'::text[],'Dry clean recommended.'),
 ('jackets','Lightweight Field Jacket','lightweight-field-jacket','A practical layering jacket with clean utility details.',5499::numeric(10,2),'relaxed','Cotton ripstop','{casual}'::text[],'Machine wash cold; close fastenings.'),
 ('jackets','Quilted Everyday Jacket','quilted-everyday-jacket','A lightweight quilted jacket for cool-weather layering.',6499::numeric(10,2),'regular','Recycled poly shell, cotton lining','{casual,party}'::text[],'Gentle machine wash; line dry.')
) as p(category_slug,name,slug,description,price,fit,fabric,occasion,care)
join public.categories c on c.slug=p.category_slug
on conflict (slug) do update set category_id=excluded.category_id,name=excluded.name,description=excluded.description,price=excluded.price,fit=excluded.fit,fabric=excluded.fabric,occasion=excluded.occasion,care_instructions=excluded.care_instructions,size_chart=excluded.size_chart,is_active=true;

insert into public.product_variants(product_id,size,color,sku,stock,is_active)
select p.id,s.size,c.color,
  upper(regexp_replace(p.slug,'[^a-z0-9]+','-','g')) || '-' || upper(s.size) || '-' || upper(left(regexp_replace(c.color,'[^a-z0-9]+','','g'),3)),
  10,true
from public.products p
cross join (values ('S'),('M'),('L'),('XL'),('XXL')) as s(size)
cross join (values ('Natural'),('Navy')) as c(color)
where p.slug in ('everyday-oxford-shirt','linen-band-collar-shirt','heavyweight-crew-t-shirt','relaxed-pocket-t-shirt','straight-leg-indigo-jeans','slim-chino-trousers','two-piece-textured-suit','unstructured-cotton-blazer','classic-cotton-kurta','textured-festive-kurta','lightweight-field-jacket','quilted-everyday-jacket')
on conflict (sku) do update set stock=excluded.stock,is_active=true;

insert into public.coupons(code,discount_type,discount_value,minimum_order,maximum_discount,usage_limit,per_customer_limit,is_active)
values ('WELCOME10','percentage',10,1500,1000,500,1,true),
       ('FLAT500','fixed',500,5000,null,200,1,true),
       ('FREESHIP','free_shipping',0,0,null,1000,2,true)
on conflict (code) do update set discount_type=excluded.discount_type,discount_value=excluded.discount_value,minimum_order=excluded.minimum_order,maximum_discount=excluded.maximum_discount,usage_limit=excluded.usage_limit,per_customer_limit=excluded.per_customer_limit,is_active=excluded.is_active;
