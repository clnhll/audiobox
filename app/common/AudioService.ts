import {Injectable, NgZone} from '@angular/core';
import {Platform, LoadingController} from 'ionic-angular';
declare var Dropbox: any;
declare var cordova: any;
declare var jsmediatags: any;
declare var plugins: any;
declare var NowPlaying: any;
declare var RemoteCommand: any;

@Injectable()
export class AudioService {

  public nowPlaying: any;
  public bufferedSong: any;
  public currentTime: number;
  public duration: number;
  public playing: boolean = false;
  private db: any;
  public shuffle: boolean = localStorage.getItem('shuffle') ?
    JSON.parse(localStorage.getItem('shuffle')) : false;
  public songs = localStorage.getItem('db-songs') ? JSON.parse(localStorage.getItem('db-songs')) : [];
  private bufferedMetadata: any;
  public songsBackup = [...this.songs];
  private queue = this.shuffle ? this.shuffleSongs() : this.songs;
  private queueBackup = [...this.queue];
  public repeatOne: boolean = localStorage.getItem('repeatOne') ?
    JSON.parse(localStorage.getItem('repeatOne')) :
    false;
  public repeatAll: boolean = localStorage.getItem('repeatAll') ?
    JSON.parse(localStorage.getItem('repeatAll')) :
    false;
  public nowPlayingIndex: number = -1;
  public nowPlayingSongMeta: any;
  public nowPlayingSong: any;
  public nowPlayingSongUrl: string;
  public bufferedSongInfo: any;
  public checkInterval: any;
  public filterQuery: string = '';
  private bufferedSongUrl: string;
  public onSongChange: any = () => {};

  constructor(private platform: Platform, private zone: NgZone, private loadingCtrl: LoadingController) {
    let loading: any = false;
    if (!this.songs.length) {
      loading = this.loadingCtrl.create({
        content: 'Loading...'
      });
      loading.present();
    }
    // if (!this.nowPlaying) {
    this.authenticate()
      .then(this.getAllSongs.bind(this))
      .then(() => {
        if (loading) loading.dismiss();
      });
    // }
    platform.ready().then(() => {
      if (!(<any>window).NowPlaying) {
        Object.assign(window, {NowPlaying: {set: (obj) => console.log(obj)}});
      }
      if (!(<any>window).plugins) return;
      RemoteCommand.on('command', (command) => {
        this.zone.run(() => {
          ({
            'nextTrack': this.playNextSong.bind(this),
            'previousTrack': this.back.bind(this),
            'play': this.playPause.bind(this),
            'pause': this.playPause.bind(this)
          })[command]()
        })
      });
    });
  }

  authenticate() {
    return new Promise((resolve, reject) => {
      this.platform.ready().then(() => {
        var client = new Dropbox.Client({key: "0hamg1r92zjn9sc"});
          client.authDriver((<any>window).cordova ?
          new Dropbox.AuthDriver.Cordova() :
          new Dropbox.AuthDriver.Redirect());
          client.authenticate((error, db) => {
            if (error) {
              reject(error);
              return;
            }
            this.db = db;
            (<any>window).db = db;
            resolve();
          });
      });
    });
  }

  getAllSongs() {
    return Promise.all([
      new Promise((resolve, reject) => {
        this.db.search('', 'mp3', (err, res) => {
          if (err) reject();
          this.formatSongs(res);
          resolve();
        })
      }),
      new Promise((resolve, reject) => {
        this.db.search('', 'm4a', (err, res) => {
          if (err) reject();
          this.formatSongs(res);
          resolve()
        })
      }),
      new Promise((resolve, reject) => {
        this.db.search('', 'wav', (err, res) => {
          if (err) reject();
          this.formatSongs(res);
          resolve();
        })
      })
    ]).then(() => {
      localStorage.setItem('db-songs', JSON.stringify(this.songs));
      this.queue = this.shuffle ? this.shuffleSongs() : this.songs;
      this.songsBackup = this.songsBackup.concat(this.songs);
      return this.songs;
    });
  }

  formatSongs(res) {
    res = res.filter(song => song.isFile);
    this.setSongs(res.map((song) => ({
      title: song.path.split('/').reverse()[0].replace('.mp3', '').replace('.wav', '').replace('.m4a', ''),
      path: song.path,
      isFile: song.isFile
    })));
    this.songs = this.songs.sort((a, b) => a.path < b.path ? -1 : 1);
  }

  getSongUrl(song) {
    let path = song.path;
    return new Promise((resolve, reject) => {
      this.db.makeUrl(path, {download: true}, (err, res) => {
        if (err) reject(err);
        resolve(res.url);
      });
    });
  }

  playSong(song) {

    this.getSongUrl(song).then(this.playUrl.bind(this));
    this.nowPlayingSong = song;
    this.nowPlayingIndex = this.queue.indexOf(song);
    this.bufferNext();
  }

  playUrl(url) {
    if (this.nowPlaying) {
      this.nowPlaying.pause();
      delete this.nowPlaying;
    }
    this.nowPlaying = new Audio;
    this.nowPlaying.onended = () => {
      if (this.repeatOne) {
        this.nowPlaying.currentTime = 0;
        this.nowPlaying.play();
        this.onSongChange();
      } else {
        this.playNextSong();
      }
    }
    if (this.nowPlaying) {
      this.nowPlaying.pause();
    }
    this.nowPlaying.onprogress = () => {
      this.currentTime = this.nowPlaying.currentTime;
    }
    let metaPromise = this.getMeta(url);
    this.nowPlaying.oncanplaythrough = () => {
      this.nowPlaying.play();
      metaPromise.then(this.setLockScreenInfo.bind(this));
    }
    this.nowPlaying.src = url;
    this.nowPlaying.load();
    this.setUpTimeTracking()
    this.nowPlayingSongUrl = url;
    this.onSongChange();
  }

  playNextSong() {
    if (this.bufferedSong) {
      this.nowPlayingIndex++;
      this.playBufferedSong();
      return;
    }
    if (this.canPlayNextSong()) {
      const nextSong = this.getNextSongToPlay();
      if (this.nowPlayingIndex === this.queue.length - 1) {
        this.nowPlayingIndex = 0;
      } else {
        this.nowPlayingIndex++;
      }
      this.playSong(nextSong);
    }
  }

  canGoBack() {
    return this.nowPlayingIndex > 0;
  }

  canPlayNextSong() {
    return this.nowPlayingIndex !== this.queue.length - 1 || this.repeatAll;
  }

  getNextSongToPlay() {
    return this.queue[this.nowPlayingIndex + 1];
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    localStorage.setItem('shuffle', JSON.stringify(this.shuffle));
    this.queue = this.shuffle ? this.shuffleSongs() : this.songs;
    delete this.bufferedSong;
    delete this.bufferedSongInfo;
    delete this.bufferedSongUrl;
    delete this.bufferedMetadata;
    this.nowPlayingIndex = this.queue.indexOf(this.nowPlayingSong);
    this.bufferNext();
  }

  pause() {
    this.nowPlaying.pause();
  }

  play() {
    if (this.nowPlaying) {
      this.nowPlaying.play();
      this.playing = true;
      this.setLockScreenInfo();
    } else {
      this.playNextSong();
    }
  }

  back() {
    if (this.nowPlaying.currentTime > 5) {
      this.nowPlaying.currentTime = 0;
      this.setLockScreenInfo();
    } else {
      if (this.canGoBack()) {
        this.nowPlayingIndex -= 1;
        this.playSong(this.queue[this.nowPlayingIndex]);
      } else {
        this.nowPlaying.pause();
        this.nowPlaying.currentTime = 0;
        this.setLockScreenInfo();
      }
    }
  }

  bufferNext() {
    if (this.canPlayNextSong()) {
      this.bufferedSongInfo = this.getNextSongToPlay();
      this.getSongUrl(this.bufferedSongInfo).then(url => {
        this.bufferedSongUrl = <string>url;
        let x = new Audio;
        x.src = <string>url;
        x.load();
        this.bufferedSong = x;
        this.getMeta(url, true);
      });
    } else {
      delete this.bufferedSong;
      delete this.bufferedSongInfo;
    }
  }

  playBufferedSong() {
    this.zone.run(() => {
      this.nowPlaying.pause();
      this.nowPlayingSongUrl = this.bufferedSongUrl;
      delete this.nowPlaying;
      this.nowPlaying = this.bufferedSong;
      this.nowPlayingSong = this.bufferedSongInfo;
      this.nowPlaying.onended = this.playNextSong.bind(this);
      this.nowPlaying.onprogress = () => {
        this.currentTime = this.nowPlaying.currentTime;
      }
      delete this.bufferedSong;
      delete this.bufferedSongInfo;
      this.nowPlayingSongMeta = this.bufferedMetadata;
      if (this.nowPlaying.readyState === 4) {
        this.nowPlaying.play();
        this.setLockScreenInfo();
      } else {
        this.nowPlaying.oncanplaythrough = () => {
          this.nowPlaying.play();
          this.setLockScreenInfo();
        };
      }
      this.bufferNext();
      this.onSongChange();
      this.setUpTimeTracking()
    })

  }

  playPause() {
    if (this.playing) {
      this.nowPlaying.pause();
      this.setLockScreenInfo();
      this.playing = false;
    } else {
      this.play();
    }
  }

  shuffleSongs () {
    let array = [...this.songs];
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }

  filterQueue(event) {
    if (!event.target.value || event.target.value === '') {
      this.clearFilter();
    } else {
      let filteredSongs = this.songsBackup.filter(song =>
        song.path.toLowerCase().includes(event.target.value.toLowerCase()));
      this.nowPlayingIndex = filteredSongs.indexOf(this.nowPlayingSong);
      this.queue = this.queueBackup.filter(song =>
        song.path.toLowerCase().includes(event.target.value.toLowerCase()));
      this.songs = filteredSongs;
    }
  }

  clearFilter() {
    this.songs = this.songsBackup;
    this.queue = this.queueBackup;
    this.nowPlayingIndex = this.queue.indexOf(this.nowPlayingSong);
  }

  setUpTimeTracking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.checkInterval = setInterval(() => {
      if (this.nowPlaying && !this.nowPlaying.paused) {
        this.playing = !this.nowPlaying.paused;
        this.currentTime = this.nowPlaying.currentTime;
        this.duration = this.nowPlaying.duration;
      }
    }, 1000)
  }

  updateTime(x) {
    this.nowPlaying.currentTime = x;
    NowPlaying.set({
      elapsedPlaybackTime: x,
      playbackRate: this.nowPlaying.paused ? 0 : 1,
      duration: this.nowPlaying.duration
    });
  }

  formatTime(seconds): string {
    let sec = ((~~seconds) % 60).toString();
    if (sec.length === 1) {
      sec = '0' + sec;
    }
    return `${~~(seconds / 60)}:${sec}`
  }

  getMeta(url, isBuffer = false) {
    return new Promise((resolve, reject) => {
      jsmediatags.read(url, {
        onSuccess: (tag) => {
          let meta = {
            artist: tag.tags.artist ? tag.tags.artist : 'Unknown Artist',
            albumTitle: tag.tags.album ? tag.tags.album : 'Unknown Album',
            title: tag.tags.title ? tag.tags.title : (!isBuffer ? this.nowPlayingSong.title : this.bufferedSongInfo.title),
          };
          if (tag.tags.picture) {
            let uInt8Array = tag.tags.picture.data;
            let i = uInt8Array.length;
            let binaryString = new Array(i);
              while (i--) {
                binaryString[i] = String.fromCharCode(uInt8Array[i]);
              }
            let data = binaryString.join('');
            let base64 = 'data:image/png;base64,' + btoa(data);
            (<any>meta).artwork = base64;
          }
          if (isBuffer) {
            this.bufferedMetadata = meta;
          } else {
            this.nowPlayingSongMeta = meta;
          }
          resolve(meta);
        },
        onError: (error) => {
          let meta = {
            artist: 'Unknown Artist',
            albumTitle: 'Unknown Album',
            title: !isBuffer ? this.nowPlayingSong.title : this.bufferedSongInfo.title,
          }
          if (isBuffer) {
            this.bufferedMetadata = meta;
          } else {
            this.nowPlayingSongMeta = meta;
          }
          resolve(meta);
        }
      });
    });

  }

  toggleRepeat() {
    if (this.repeatOne) {
      this.repeatOne = false;
    } else if (this.repeatAll) {
      this.repeatOne = true;
      this.repeatAll = false;
    } else {
      this.repeatAll = true;
    }
    localStorage.setItem('repeatOne', JSON.stringify(this.repeatOne));
    localStorage.setItem('repeatAll', JSON.stringify(this.repeatAll));
  }

  shareSong() {
    var options = {
      message: `${this.nowPlayingSongMeta.title} by ${this.nowPlayingSongMeta.artist}`, // not supported on some apps (Facebook, Instagram)
      subject: `${this.nowPlayingSongMeta.title} by ${this.nowPlayingSongMeta.artist}`, // fi. for email
      files: this.nowPlayingSongMeta.artwork ? [this.nowPlayingSongMeta.artwork] : [], // an array of filenames either locally or remotely
      url: this.nowPlayingSongUrl,
    }
    if (!(<any>window).cordova || !this.nowPlaying || !this.nowPlayingSongMeta.title) {
      console.log(options);
      return
    };

    var onSuccess = function(result) {
    }

    var onError = function(msg) {
    }

    plugins.socialsharing.shareWithOptions(options, onSuccess, onError);
  }

  setLockScreenInfo() {
    if (!this.nowPlayingSongMeta) return;
    setTimeout(() => {
      NowPlaying.set(Object.assign({
        playbackRate: this.nowPlaying.paused ? 0 : 1,
        elapsedPlaybackTime: this.nowPlaying.currentTime,
        duration: this.nowPlaying.duration
      }, this.nowPlayingSongMeta));
    }, 500);
  }

  setSongs(newSongs) {
    let paths = this.songs.map(s => s.path);
    newSongs.forEach(song => {
      if (!paths.includes(song.path)) this.songs.push(song)
    });
  }

}
