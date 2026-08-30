import { Injectable, signal } from '@angular/core';
import { BackendApiService } from './backend-api.service';
export type AppUser={id:number;name:string;phone:string;role:'CUSTOMER'|'SELLER'|'ADMIN'};
export type AuthResult={error:null|{message:string};data?:any};
@Injectable({providedIn:'root'}) export class AuthService {
  readonly user=signal<AppUser|null>(null);
  readonly role=signal<'CUSTOMER'|'SELLER'|'ADMIN'>('CUSTOMER');
  private initialized:Promise<void>;
  private readyPromise:Promise<void>|null=null;
  private readyToken:string|null=null;

  constructor(private api:BackendApiService){
    this.initialized=Promise.resolve(this.restore());
  }

  /**
   * Guards can execute on every navigation. Do not call /auth/me on every
   * route change: validate the current JWT once and reuse that result until
   * the token changes or the user logs in/out.
   */
  async ready(){
    await this.initialized;
    const token=localStorage.getItem('wissfind_jwt');
    if(!token){
      this.readyPromise=null;
      this.readyToken=null;
      return;
    }
    if(this.readyPromise && this.readyToken===token) {
      await this.readyPromise;
      return;
    }

    this.readyToken=token;
    this.readyPromise=(async()=>{
      try{
        const r:any=await this.api.get('/auth/me');
        if(r.token){
          localStorage.setItem('wissfind_jwt',r.token);
          this.readyToken=r.token;
        }
        if(r.user){
          localStorage.setItem('wissfind_user',JSON.stringify(r.user));
          this.setUser(r.user);
        }
      }catch{
        // Keep the locally restored user for transient backend/network errors.
        // A real 401 is handled by the protected API request itself.
      }
    })();

    await this.readyPromise;
  }
  private restore(){const raw=localStorage.getItem('wissfind_user');if(raw){try{this.setUser(JSON.parse(raw));}catch{this.clear();}}}
  private setUser(u:AppUser|null){this.user.set(u);this.role.set(u?.role??'CUSTOMER');}
  private clear(){localStorage.removeItem('wissfind_jwt');localStorage.removeItem('wissfind_user');this.setUser(null);}
  async signIn(phone:string,password:string):Promise<AuthResult>{try{const r:any=await this.api.post('/auth/login',{phone,password});localStorage.setItem('wissfind_jwt',r.token);localStorage.setItem('wissfind_user',JSON.stringify(r.user));this.setUser(r.user);this.readyPromise=null;this.readyToken=null;return {error:null,data:r};}catch(e:any){return {error:{message:e?.error?.error||e?.message||'Login failed'}};}}
  async signUp(phone:string,password:string,name:string):Promise<AuthResult>{try{localStorage.setItem('wissfind_signup_name',name.trim());localStorage.setItem('wissfind_signup_password',password);const r:any=await this.api.post('/auth/otp/send',{phone,purpose:'SIGNUP'}); if(r?.devOtp)localStorage.setItem('wissfind_dev_otp',String(r.devOtp)); return {error:null,data:r};}catch(e:any){return {error:{message:e?.error?.error||e?.message||'Unable to send OTP'}};}}
  async verifySignupOtp(phone:string,token:string):Promise<AuthResult>{try{const name=localStorage.getItem('wissfind_signup_name')||'WissFind Customer';const password=localStorage.getItem('wissfind_signup_password')||'';const r:any=await this.api.post('/auth/register',{phone,password,name,otp:token});localStorage.setItem('wissfind_jwt',r.token);localStorage.setItem('wissfind_user',JSON.stringify(r.user));this.setUser(r.user);return {error:null,data:r};}catch(e:any){return {error:{message:e?.error?.error||e?.message||'OTP verification failed'}};}}
  async resendSignupOtp(phone:string){return this.signUp(phone,localStorage.getItem('wissfind_signup_password')||'',localStorage.getItem('wissfind_signup_name')||'WissFind Customer');}
  async sendPasswordResetOtp(phone:string):Promise<AuthResult>{try{const r:any=await this.api.post('/auth/otp/send',{phone,purpose:'RESET'});if(r?.devOtp)localStorage.setItem('wissfind_dev_otp',String(r.devOtp));return {error:null,data:r};}catch(e:any){return {error:{message:e?.error?.error||e?.message||'Unable to send OTP'}};}}
  async verifyPasswordResetOtp(phone:string,token:string):Promise<AuthResult>{try{const r:any=await this.api.post('/auth/otp/verify',{phone,otp:token,purpose:'RESET'});if(!r?.verified)throw new Error('Invalid OTP');localStorage.setItem('wissfind_reset_phone',phone);localStorage.setItem('wissfind_reset_otp',token);return {error:null};}catch(e:any){return {error:{message:e?.error?.error||e?.message||'Invalid OTP'}};}}
  async updatePassword(password:string):Promise<AuthResult>{try{const phone=localStorage.getItem('wissfind_reset_phone');const otp=localStorage.getItem('wissfind_reset_otp');if(!phone||!otp)throw new Error('Reset session expired. Please request a new OTP.');await this.api.post('/auth/reset-password',{phone,otp,password});localStorage.removeItem('wissfind_reset_phone');localStorage.removeItem('wissfind_reset_otp');localStorage.removeItem('wissfind_dev_otp');return {error:null};}catch(e:any){return {error:{message:e?.error?.error||e?.message||'Unable to update password'}};}}
  async signOut(){this.clear();this.readyPromise=null;this.readyToken=null;return {error:null};}
  getRole(){return this.role();}
}
