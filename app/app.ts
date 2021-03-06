import {Component, enableProdMode} from '@angular/core';
import {Platform, ionicBootstrap} from 'ionic-angular';
import {StatusBar, Keyboard} from 'ionic-native';
import {HomePage} from './pages/home/home';
import {AudioService} from './common/AudioService';

@Component({
  template: '<ion-nav [root]="rootPage"></ion-nav>'
})
export class MyApp {

  private rootPage: any;

  constructor(private platform: Platform) {
    this.rootPage = HomePage;

    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      if ((<any>window).plugins) {
        Keyboard.hideKeyboardAccessoryBar(false)
        StatusBar.styleDefault();
      }
    });
  }
}
enableProdMode();
ionicBootstrap(MyApp, [AudioService]);
