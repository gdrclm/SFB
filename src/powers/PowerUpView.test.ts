import {afterEach,expect,it,vi} from "vitest";
import {PowerUpController} from "./PowerUpController";
import {PowerUpView} from "./PowerUpView";
class Button extends EventTarget{
 public dataset:Record<string,string>={};public disabled=false;public title="";
 public classList={remove:()=>{}};public style={removeProperty:()=>{},setProperty:()=>{}};
 public setAttribute():void{} public querySelector():null{return null;}
 public setPointerCapture():void{}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function setup(){
 vi.useFakeTimers();vi.stubGlobal("window",new EventTarget());vi.stubGlobal("document",Object.assign(new EventTarget(),{hidden:false,hasFocus:()=>false}));
 const button=new Button(),sweep=vi.fn(),mini=vi.fn();
 const powers=new PowerUpController({annihilation:true,plasma:false,impactRetention:0,dangerRange:0},{position:{x:0,y:0},fallSpeed:10},()=>true,()=>{},sweep,mini);
 const view=new PowerUpView(button as unknown as HTMLButtonElement,powers,"annihilation");
 const pointer=(type:string)=>button.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{button:0,pointerId:1}));
 return{button,powers,view,sweep,mini,pointer};
}
it("fires a full hold at three seconds on touch even when hasFocus is false, and suppresses the following tap",()=>{
 const f=setup();f.pointer("pointerdown");vi.advanceTimersByTime(2999);expect(f.sweep).not.toHaveBeenCalled();
 vi.advanceTimersByTime(1);expect(f.sweep).toHaveBeenCalledOnce();f.pointer("pointerup");f.button.dispatchEvent(new Event("click"));
 expect(f.mini).not.toHaveBeenCalled();expect(f.powers.annihilationCharges).toBe(0);f.view.dispose();
});
it("spends exactly one charge for a short pointer press and none for a cancelled hold",()=>{
 const f=setup();f.pointer("pointerdown");vi.advanceTimersByTime(100);f.pointer("pointerup");f.button.dispatchEvent(new Event("click"));
 expect(f.mini).toHaveBeenCalledOnce();expect(f.powers.annihilationCharges).toBe(3);
 f.pointer("pointerdown");f.pointer("pointercancel");vi.advanceTimersByTime(3100);f.button.dispatchEvent(new Event("click"));
 expect(f.powers.annihilationCharges).toBe(3);f.view.dispose();
});
it("uses the same three-second hold for the keyboard and cancels on pause or focus loss",()=>{
 const f=setup();f.view.keyboardDown();vi.advanceTimersByTime(1000);f.view.render(true);vi.advanceTimersByTime(3000);
 expect(f.sweep).not.toHaveBeenCalled();expect(f.powers.annihilationCharges).toBe(4);
 f.view.render(false);f.view.keyboardDown();vi.advanceTimersByTime(1000);window.dispatchEvent(new Event("blur"));vi.advanceTimersByTime(3000);
 expect(f.sweep).not.toHaveBeenCalled();expect(f.mini).not.toHaveBeenCalled();
 f.view.keyboardDown();vi.advanceTimersByTime(2999);expect(f.sweep).not.toHaveBeenCalled();
 vi.advanceTimersByTime(1);f.view.keyboardUp();expect(f.sweep).toHaveBeenCalledOnce();expect(f.mini).not.toHaveBeenCalled();f.view.dispose();
});
