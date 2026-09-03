const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise mobile POS layout correction */";

if (!css.includes(marker)) {
  css += `

  ${marker}
  /* Category pills must keep their natural width. The previous flex behavior
     allowed them to shrink, which caused labels to overlap on narrow screens. */
  .category-row{min-width:0;max-width:100%;overflow-x:auto;overflow-y:hidden;display:flex;flex-wrap:nowrap;align-items:center;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  .category-row::-webkit-scrollbar{display:none}
  .category{flex:0 0 auto;width:max-content;min-width:max-content;white-space:nowrap;box-sizing:border-box}
  .search-row,.search-box{min-width:0;max-width:100%}
  .search-box input{min-width:0;width:100%}
  .catalog-panel,.order-panel{min-width:0;max-width:100%;overflow:hidden}
  .product-grid{min-width:0;width:100%}
  .product-card{min-width:0;max-width:100%;overflow:hidden}
  .product-info{min-width:0}.product-info b,.product-info span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  @media(max-width:1100px){
    .pos-layout{grid-template-columns:minmax(0,1fr);width:100%;max-width:100%;overflow:hidden}
    .catalog-panel,.order-panel{width:100%}
  }

  @media(max-width:700px){
    .workspace{width:100%;min-width:0;max-width:100%;overflow-x:hidden}
    .topbar{min-height:68px;padding:12px 12px 12px 66px;gap:10px}
    .topbar h1{font-size:20px;line-height:1.15}
    .top-actions{gap:8px;flex-shrink:0}
    .status{font-size:10px;white-space:nowrap}
    .icon-btn{width:44px;height:44px;padding:0;display:grid;place-items:center}
    .pos-layout{padding:8px;gap:8px}
    .catalog-panel,.order-panel{padding:10px;border-radius:12px}
    .search-box{height:46px;padding:0 11px;gap:8px;border-radius:10px}
    .search-box input{font-size:16px}
    .category-row{gap:7px;padding:10px 0 9px;margin:0;width:100%;max-width:100%;overscroll-behavior-x:contain;scroll-snap-type:x proximity}
    .category{min-height:42px;height:42px;padding:0 14px;border-radius:21px;font-size:12px;line-height:1;display:inline-flex;align-items:center;justify-content:center;scroll-snap-align:start}
    .product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .product-card{min-height:128px;padding:10px;border-radius:11px}
    .product-icon{width:42px;height:42px;margin-bottom:8px}
    .product-info b{font-size:12px}
    .product-info span{font-size:10px}
    .product-info strong{font-size:13px}
    .add-circle{right:9px;bottom:9px;width:30px;height:30px}
    .order-panel{position:static;min-height:auto}
    .cart-list{min-height:160px;max-height:none}
    .payment-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    .payment-option{min-height:44px;padding:8px 4px}
    .tendered{grid-template-columns:minmax(0,1fr) 105px}
    .process-btn{min-height:48px;padding:12px}
  }

  @media(max-width:420px){
    .topbar{padding-left:62px}
    .topbar h1{font-size:18px}
    .status{display:none}
    .pos-layout{padding:6px;gap:6px}
    .catalog-panel,.order-panel{padding:9px}
    .product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    .product-card{min-height:120px;padding:9px}
    .category{padding-inline:13px}
    .tendered{grid-template-columns:1fr}
    .tendered input{width:100%}
  }

  @media(hover:none) and (pointer:coarse){
    .category,.payment-option,.add-circle,.qty button,.process-btn,.clear-btn,.icon-btn{touch-action:manipulation}
    .category,.payment-option,.clear-btn{min-height:44px}
  }
  `;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Corrected mobile POS category, search, product and order layouts.");
