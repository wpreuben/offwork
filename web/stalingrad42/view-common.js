export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const options=(values,current)=>values.map(([value,label])=>`<option value="${esc(value)}"${String(current)===String(value)?' selected':''}>${esc(label)}</option>`).join('');
export const checked=value=>value?' checked':'';
