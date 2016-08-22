import {Component} from '@angular/core';
import {NavController, ViewController} from 'ionic-angular';
import {AudioService} from '../../common/AudioService';
@Component({
  templateUrl: 'build/pages/about/about.html'
})
export class NowPlaying {
  constructor(
    private navCtrl: NavController,
    private as: AudioService,
    private viewCtrl: ViewController
  ) {
  }
  dismiss() {
    this.viewCtrl.dismiss();
  }
}
