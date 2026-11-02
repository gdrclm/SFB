/** A quiet shaft between the ruins stays clear for the ball and readable routes. */
export const RUINS_CLEAR_HALF_WIDTH=6;
export const RUINS_ATLAS_SIZE=[1536,1024] as const;
export const RUINS_ARCHES=[
 {x:-10.4,anchor:14,rate:.09,scale:1.08},
 {x:10.6,anchor:2,rate:.13,scale:.95},
 {x:-10.8,anchor:-12,rate:.19,scale:1.02},
] as const;
/** Complete illustrated silhouettes; atlas coordinates are measured source pixels. */
export const RUINS_PROPS=[
 {name:"left-ledge",bounds:[45,0,550,512],x:-11.1,anchor:15,rate:.70,height:8.1,opacity:1,kind:"stone"},
 {name:"right-ledge",bounds:[600,0,1090,512],x:11.2,anchor:5,rate:.85,height:8.1,opacity:1,kind:"stone"},
 {name:"cage",bounds:[1168,0,1415,512],x:10.8,anchor:17,rate:.94,height:6.6,opacity:.72,kind:"cage"},
 {name:"lantern",bounds:[135,512,345,1024],x:-10.3,anchor:-9,rate:.82,height:6.1,opacity:.94,kind:"cage"},
 {name:"arch",bounds:[510,512,1040,1024],x:-10.8,anchor:-19,rate:.12,height:7.0,opacity:.27,kind:"stone"},
 {name:"pillar",bounds:[1150,512,1505,1024],x:11.7,anchor:-11,rate:.48,height:7.8,opacity:.70,kind:"stone"},
] as const;
export const RUINS_CAGES=[
 {x:-10.0,anchor:17,rate:.98,scale:.82,phase:.3},
 {x:10.8,anchor:-1,rate:1.05,scale:.94,phase:2.0},
 {x:-11.7,anchor:-10,rate:.53,scale:.67,phase:4.5},
] as const;
export const RUINS_TORCHES=[
 {x:-12.28,anchor:17.15,rate:.70,phase:.2},
 {x:12.38,anchor:6.85,rate:.85,phase:1.8},
 {x:-10.3,anchor:-10.03,rate:.82,phase:3.9},
 {x:10.41,anchor:-10.9,rate:.48,phase:5.3},
] as const;
