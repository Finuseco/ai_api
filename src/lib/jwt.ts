import jwt from 'jsonwebtoken';
export interface JwtPayload {id:number; username:string; manager_name:string; b2b_user_id?:number|null}
export function verifyToken(token:string):JwtPayload|null {
  const secret=process.env.JOJO_AUTH_JWT_SECRET || process.env.JWT_SECRET;
  if(!secret || secret.length<32) return null;
  try {
    const decoded=jwt.verify(token,secret,{algorithms:['HS256'],
      ...(process.env.JOJO_AUTH_ISSUER?{issuer:process.env.JOJO_AUTH_ISSUER}:{}),
      ...(process.env.JOJO_AUTH_AUDIENCE?{audience:process.env.JOJO_AUTH_AUDIENCE}:{})});
    return typeof decoded==='object' && Number.isSafeInteger(Number(decoded.id)) && Number(decoded.id)>0 ? decoded as JwtPayload : null;
  } catch {return null;}
}
