const fs = require("fs");
const path = require("path");

const cssPath = path.join(process.cwd(), "app", "pos", "pos.css");
let css = fs.readFileSync(cssPath, "utf8");
const marker = "/* PrintWise modern POS layout - Merchantry inspired, PrintWise branded */";

if (!css.includes(marker)) {
  css += `

${marker}
/* Improve the POS information hierarchy and spacing without changing the existing dark PrintWise navigation. */
.app-shell{background:#f5f6f8}
.workspace{background:#f5f6f8}
.topbar{min-height:74px;padding:16px 24px;border-bottom:1px solid #e2e5e9}
.topbar h1{font-size:23px;font-weight:650;letter-spacing:-.25px;color:#172033}
.topbar p{font-size:12px;color:#737b86}
.top-actions{gap:9px}
.icon-btn{width:42px;height:42px;padding:0;display:grid;place-items:center;border-radius:10px;color:#344054}
.status{font-size:11px}

.pos-layout{grid-template-columns:minmax(0,1fr) 410px;gap:14px;padding:16px 18px 20px;align-items:stretch}
.catalog-panel,.order-panel{border:1px solid #e1e5ea;border-radius:14px;box-shadow:0 2px 8px rgba(16,24,40,.035)}
.catalog-panel{padding:16px}
.search-row{margin-bottom:0}
.search-box{height:48px;background:#fff;border-color:#d9dee5;border-radius:10px;padding:0 14px}
.search-box input{font-size:14px;color:#172033}
.search-box input::placeholder{color:#8a919c}
.category-row{gap:7px;padding:13px 0 15px;scrollbar-width:none}
.category-row::-webkit-scrollbar{display:none}
.category{background:#fff;border-color:#dce1e7;color:#475467;border-radius:19px;padding:8px 14px;font-size:11px;font-weight:600;transition:background .15s,border-color .15s,color .15s,transform .15s}
.category:hover{border-color:#d71920;color:#d71920}
.category.selected{background:#d71920;border-color:#d71920;color:#fff}

.product-grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:11px}
.product-card{min-height:190px;border-color:#e0e4e9;border-radius:13px;padding:15px;background:#fff;box-shadow:0 1px 3px rgba(16,24,40,.025)}
.product-card:hover{border-color:#d71920;box-shadow:0 8px 18px rgba(16,24,40,.07);transform:translateY(-2px)}
.product-icon{width:54px;height:54px;border-radius:12px;background:#fff1f1;margin-bottom:13px;color:#d71920}
.product-icon svg{width:25px;height:25px}
.product-info{gap:5px}
.product-info b{font-size:13px;font-weight:650;color:#172033;line-height:1.25}
.product-info span{font-size:11px;color:#8a919c}
.product-info strong{font-size:15px;font-weight:750;color:#d71920;margin-top:4px}
.add-circle{width:32px;height:32px;right:13px;bottom:13px;background:#fff1f1;color:#d71920;border:1px solid #ffd8d9}

.order-panel{padding:16px;min-height:calc(100vh - 106px);top:10px;background:#fff}
.order-head{padding-bottom:13px}
.order-head h2{font-size:17px;font-weight:700;color:#172033}
.order-head span{font-size:11px}
.clear-btn{padding:8px 10px;font-size:11px}
.customer-box{margin:12px 0;border-color:#e0e4e9;background:#fff;padding:10px 11px}
.customer-box input{font-size:13px}
.cart-list{max-height:none;min-height:220px}
.cart-item{padding:12px 0;grid-template-columns:40px minmax(0,1fr) auto;gap:10px}
.cart-item-icon{width:38px;height:38px;background:#fff1f1}
.cart-item-name>b{font-size:12px;font-weight:650;color:#172033}
.cart-item-name>span{font-size:10px}
.cart-item>strong{font-size:12px;font-weight:700;color:#172033}
.qty{gap:7px}
.qty button{width:26px;height:26px}

.summary{margin-top:8px;padding-top:10px;border-top:1px solid #e5e7eb}
.summary>div{font-size:12px;margin:8px 0}
.summary span{color:#667085}
.summary b{font-weight:600;color:#344054}
.total-row{font-size:18px!important;padding-top:8px;margin-top:10px!important;border-top:1px solid #e5e7eb}
.total-row b{font-size:19px;color:#d71920;font-weight:750}
.payment-section h3{font-size:12px;font-weight:700;color:#344054;margin:14px 0 8px}
.payment-grid{gap:7px}
.payment-option{border-radius:9px;padding:8px 4px;font-size:10px;background:#fff;min-height:52px}
.payment-option.chosen{border-color:#d71920;background:#fff1f1;color:#d71920}
.process-btn{margin-top:12px;border-radius:10px;padding:14px 15px;background:#d71920;box-shadow:0 8px 18px rgba(215,25,32,.16)}
.process-btn strong{font-size:14px;font-weight:750}

/* Keep PrintWise's existing dark navigation untouched. */
.sidebar{background:#24262b;color:#fff}
.nav-item.active{background:#3a3d44;color:#fff;box-shadow:inset 3px 0 #d71920}
.brand-mark,.avatar{background:#d71920}

@media(max-width:1200px){
  .pos-layout{grid-template-columns:minmax(0,1fr) 360px}
  .product-grid{grid-template-columns:repeat(auto-fill,minmax(175px,1fr))}
}

@media(max-width:1100px){
  .pos-layout{grid-template-columns:1fr;padding:14px}
  .order-panel{min-height:auto;position:static}
  .product-grid{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
}

@media(max-width:700px){
  .topbar{min-height:68px;padding:12px}
  .topbar h1{font-size:20px}
  .pos-layout{padding:9px}
  .catalog-panel,.order-panel{padding:11px;border-radius:12px}
  .product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .product-card{min-height:145px;padding:11px}
}
`;
  fs.writeFileSync(cssPath, css, "utf8");
}

console.log("PrintWise: Applied Merchantry-inspired POS layout while preserving PrintWise navigation colors.");
