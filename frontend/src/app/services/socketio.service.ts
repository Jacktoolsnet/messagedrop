import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { SocketIoConfig, Socket } from 'ngx-socket-io';

@Injectable({
  providedIn: 'root',
})

export class SocketioService {
  private socket: Socket
  private ioConfig: SocketIoConfig = { url: `${environment.apiUrl}`, options: { transports: ['websocket'] } };
  private connected: boolean = false;

  constructor() { 
    this.socket = new Socket(this.ioConfig);
    this.socket.on("connect", () => {
      this.connected = this.socket.ioSocket.connected;
    });
    this.socket.on("disconnect", () => {
      this.connected = false;
    });
  }

  public getSocket(): Socket{
    return this.socket
  }

  public connect() {
    this.socket.connect();
  }
  
  public disconnect() {
    this.socket.disconnect();
  }

  public isConnected(): boolean{
    return this.connected;
  }

  public joinRoom(room: String, callback: (response: String) => any) {    
    this.socket.on(`user:${room}`, callback)
    this.socket.emit('user:joinUserRoom', room)
  }

}
