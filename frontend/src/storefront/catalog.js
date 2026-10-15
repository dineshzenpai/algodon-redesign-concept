export const conceptProducts = [
  { id:'golden-brown', name:'Golden-Brown Swirl', brand:'Algodon', price:1900, images:['/img/product-golden-brown.jpg'], alt:'Golden-Brown swirl motif organic cotton shirt' },
  { id:'jali', name:'Rajasthan Jali', brand:'Algodon · 1 review', price:1900, images:['/img/product-jali.jpg'], alt:'Rajasthan Jali lattice print organic cotton shirt in pink' },
  { id:'pakshee', name:'Rangeen Pakshee', brand:'Algodon', price:1900, was:4400, badge:'Now 57% off', images:['/img/product-pakshee.jpg'], alt:'Rangeen Pakshee colourful bird print organic cotton shirt' },
  { id:'kamal', name:'Kamal Ka Phool', brand:'Algodon', price:1900, was:8200, badge:'Now 77% off', images:['/img/product-kamal.jpg'], alt:'Kamal Ka Phool lotus print organic cotton shirt' }
].map(product => ({...product, concept:true}));
