const token = 'eyJhbGciOi...'; 
const p = token.split('.');
function b64u(s){return atob(s.replace(/-/g,'+').replace(/_/g,'/')); }
console.log('header', JSON.parse(b64u(p[0])));
console.log('payload', JSON.parse(b64u(p[1])));