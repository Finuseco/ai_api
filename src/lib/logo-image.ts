import {PNG} from 'pngjs';
/** Decode only bounded PNGs, then trim transparent padding without inventing pixels. */
export function trimLogo(bytes:Buffer){
 if(bytes.length>5*1024*1024||bytes.length<33||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Image PNG invalide ou trop volumineuse.');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(!width||!height||width>2048||height>2048)throw Error('Dimensions du logo refusées.');
 const image=PNG.sync.read(bytes);let left=width,top=height,right=-1,bottom=-1,transparent=false;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const alpha=image.data[(y*width+x)*4+3];if(alpha<255)transparent=true;if(alpha>2){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 if(!transparent)throw Error('Le PNG reçu ne possède pas de transparence.');
 if(right<0)throw Error('Le logo reçu est vide.');
 const padding=Math.max(4,Math.ceil(Math.max(right-left+1,bottom-top+1)*0.04));left=Math.max(0,left-padding);top=Math.max(0,top-padding);right=Math.min(width-1,right+padding);bottom=Math.min(height-1,bottom+padding);
 const out=new PNG({width:right-left+1,height:bottom-top+1});PNG.bitblt(image,out,left,top,out.width,out.height,0,0);return PNG.sync.write(out);
}
