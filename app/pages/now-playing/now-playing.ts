import {Component} from '@angular/core';
import {NavController, ViewController} from 'ionic-angular';
import {AudioService} from '../../common/AudioService';
@Component({
  templateUrl: 'build/pages/now-playing/now-playing.html'
})
export class NowPlaying {
  private buttonPressed: boolean = false;
  private buttonTimeout: any;
  constructor(
    private navCtrl: NavController,
    private as: AudioService,
    private viewCtrl: ViewController) {
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }

  playPause() {
    this.buttonPressed = true;
    if (this.buttonTimeout) {
      clearTimeout(this.buttonTimeout);
      this.buttonTimeout = false;
    }
    this.as.playPause();
    this.buttonTimeout = setTimeout(() => {
      this.buttonPressed = false;
    }, 3000)
  }

}
