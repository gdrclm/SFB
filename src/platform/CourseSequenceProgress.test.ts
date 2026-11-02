import {expect,it} from "vitest";
import {CourseSequenceProgress} from "./CourseSequenceProgress";
it("counts only fully passed phrases once, independently of live pooled platforms and vertical revisits",()=>{
 const progress=new CourseSequenceProgress(),passed:string[]=[];
 const notify=(location:string,count:number)=>passed.push(`${location}:${String(count)}`);
 progress.record(1,"crystal",-20,false);progress.advance(-50,notify);expect(progress.count).toBe(0);
 progress.record(1,"crystal",-70,true);progress.advance(-70,notify);expect(progress.count).toBe(0);
 progress.advance(-70.01,notify);expect(progress.count).toBe(1);
 progress.advance(10,notify);progress.record(1,"crystal",-100,true);progress.advance(-200,notify);
 expect(passed).toEqual(["crystal:1"]);progress.reset();expect(progress.count).toBe(0);
});
