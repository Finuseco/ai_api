'use server';
import {requireUser} from '../auth';
export async function requestTransactionOtp(){
 try {await requireUser();return {success:false,message:'La recharge doit être raccordée au paiement CashPay avec vérification serveur.',error:'Recharge sécurisée non configurée. Aucun code de démonstration ne sera envoyé.'};}
 catch{return {success:false,error:'Session expirée.'};}
}
export async function buyChatCredits(_amount:number,_otp:string,_pin:string){
 try{await requireUser();return {success:false,error:'Recharge CashPay indisponible : connexion au paiement et vérification OTP serveur requises. Aucun débit effectué.'};}
 catch{return {success:false,error:'Session expirée.'};}
}
