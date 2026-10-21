import { OnlineGame } from "./OnlineGame";
import type { RunTicket } from "./types";
const get=(selector:string):HTMLElement=>{const node=document.querySelector<HTMLElement>(selector);if(node===null)throw new Error(`Missing ${selector}`);return node;};
const getDialog=(selector:string):HTMLDialogElement=>{const node=get(selector);if(!(node instanceof HTMLDialogElement))throw new Error(selector);return node;};
const getInput=(selector:string):HTMLInputElement=>{const node=get(selector);if(!(node instanceof HTMLInputElement))throw new Error(selector);return node;};
const getButton=(selector:string):HTMLButtonElement=>{const node=get(selector);if(!(node instanceof HTMLButtonElement))throw new Error(selector);return node;};
export class NetworkView {
  public readonly online = new OnlineGame();
  #tab="local";
  #poll:ReturnType<typeof setInterval>|null=null;
  #request=0;
  #firstPrompt=true;
  readonly #records=getDialog('#records');
  readonly #identity=getDialog('#player-dialog');
  public constructor(){
    get('#player-button').addEventListener('click',()=>{ this.openIdentity(); });
    get('#player-close').addEventListener('click',()=>{ this.#identity.close(); });
    get('#player-form').addEventListener('submit',event=>{event.preventDefault();void this.#saveName();});
    for(const button of document.querySelectorAll<HTMLButtonElement>('[data-records-tab]'))button.addEventListener('click',()=>{this.#tab=button.dataset.recordsTab??'local';this.openRecords();});
    get('#leaderboard-refresh').addEventListener('click',()=>{void this.online.flush();void this.refresh();});
    this.#records.addEventListener('close',()=>{this.#request++;if(this.#poll!==null)clearInterval(this.#poll);this.#poll=null;});
    this.online.subscribe(()=>{ this.#renderStatus(); if(this.#records.open&&this.#tab==="global")void this.refresh(); });
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&this.#records.open&&this.#tab==='global')void this.refresh();});
    void this.online.initialize();
  }
  #renderStatus():void{
    const player=this.online.player;
    get('#player-button').textContent=player===null?'Игрок · выбрать имя':`${player.nickname} · ${player.id.slice(0,6)}`;
    get('#network-status').textContent=this.online.status;
    get('#result-network-status').textContent=this.online.pending>0?`${this.online.status}${this.online.pending>1?` · ${String(this.online.pending)}`:''}`:this.online.status.includes('Результат')?this.online.status:'';
    getInput('#ranked-mode').disabled=player===null;
    if(player!==null&&this.#firstPrompt){getInput('#ranked-mode').checked=true;}
    if(this.online.configured&&this.online.userId!==null&&player===null&&this.#firstPrompt&&!get("#start-screen").hidden){this.#firstPrompt=false;this.openIdentity();}
    if(player!==null)this.#firstPrompt=false;
  }
  public showMenu():void{this.#renderStatus();}
  public openIdentity():void{
    getInput('#player-name').value=this.online.player?.nickname??'';
    get('#player-id').textContent=this.online.userId===null?'Анонимный аккаунт создаётся на сервере':`ID ${this.online.userId}`;
    get('#player-error').textContent=this.online.configured?'':'Для сетевого профиля нужно подключить сервер рейтинга.';
    this.#identity.showModal();
  }
  async #saveName():Promise<void>{
    const button=getButton('#player-save');button.disabled=true;
    try{await this.online.rename(getInput('#player-name').value);get('#player-error').textContent='';this.#identity.close();getInput('#ranked-mode').checked=true;}
    catch(error:unknown){get('#player-error').textContent=error instanceof Error?error.message:'Не удалось сохранить имя.';}
    finally{button.disabled=false;}
  }
  public get wantsRanked():boolean{return this.online.player!==null&&getInput('#ranked-mode').checked;}
  public async beginRun():Promise<RunTicket>{return this.online.beginRun();}
  public openRecords():void{
    get("#records .menu-eyebrow").textContent=this.#tab==="global"?"ОБЩИЙ ТОП":"ЛИЧНЫЙ ТОП";
    for(const button of document.querySelectorAll<HTMLButtonElement>('[data-records-tab]'))button.setAttribute('aria-selected',String(button.dataset.recordsTab===this.#tab));
    get('#local-records').hidden=this.#tab!=='local';get('#global-records').hidden=this.#tab!=='global';
    if(this.#poll!==null)clearInterval(this.#poll);this.#poll=null;
    if(this.#tab==='global'){
      void this.refresh();void this.online.flush();
      this.#poll=setInterval(()=>{if(this.#records.open&&!document.hidden)void this.refresh();},10000);
    }
  }
  public async refresh():Promise<void>{
    const request=++this.#request;
    get('#leaderboard-status').textContent=this.online.player===null?(!this.online.configured||this.online.userId===null?this.online.status:'Выбери имя игрока для общего рейтинга.'):'Обновление…';
    if(this.online.player===null)return;
    try{
      const board=await this.online.leaderboard();if(request!==this.#request||!this.#records.open)return;
      const list=get('#global-record-list');list.replaceChildren();
      for(const entry of board.top){
        const row=document.createElement('li');row.className='record-row';row.dataset.rank=String(entry.rank);
        if(entry.player_id===this.online.player.id)row.classList.add('record-self');
        const rank=document.createElement('span');rank.className='record-rank';rank.textContent=String(entry.rank);
        const copy=document.createElement('div');copy.className='record-copy';
        const name=document.createElement('strong');name.className='record-score';name.textContent=entry.nickname;
        const detail=document.createElement('span');detail.className='record-detail';detail.textContent=`${entry.score.toLocaleString('ru-RU')} очков · ${String(entry.depth)} м`;
        copy.append(name,detail);row.append(rank,copy);list.append(row);
      }
      get('#leaderboard-self').textContent=board.self===null?'Твой первый результат впереди':`Твоё место: ${String(board.self.rank)} · ${board.self.score.toLocaleString('ru-RU')} очков`;
      get('#leaderboard-status').textContent=board.top.length===0?'Стань первым в рейтинге демо':`Демо ${this.online.version} · обновляется каждые 10 с`;
    }catch{if(request===this.#request)get('#leaderboard-status').textContent='Рейтинг недоступен. Попробуй обновить позже.';}
  }
}
