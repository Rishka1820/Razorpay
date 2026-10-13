// English text is the key. Hindi is looked up from it; anything missing shows in English.
import { hi } from './hi';

export function tr(lang, key, vars) {
  let s = lang === 'hi' && hi[key] ? hi[key] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}
