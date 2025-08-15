<script setup>
import { ref, onMounted } from 'vue'
import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } from '@skyway-sdk/room';
import  GetToken  from './SkywayToken.js'

// SkyWayのトークンを作成する
const tokenString = GetToken(import.meta.env.VITE_SKYWAY_APP_ID, import.meta.env.VITE_SKYWAY_SECRET_KEY);

// SkyWayの実体とルームの実体を保管するため
const context = {'ctx': null, 'room': null};

// 現在のURL
const baseUrl = window.location.href.split('?')[0];
// div ref="stream-area"参考
const StreamArea = ref(null)
// 会議部屋を作ったかどうか
const RoomCreated = ref(false)
// ルームのIDの保管、シェアため
const RoomId = ref(null)


// SkyWayのAPIと繋がって実体を保管する
const getContext = async () => {
    context.ctx = await SkyWayContext.Create(tokenString);

    // トークンの更新
    context.ctx.onTokenUpdateReminder.add(() => {
        context.ctx.updateAuthToken(tokenString);
    });
    return context.ctx;
}

// 部屋を作り、ルームIDを保管する
const createRoom = async () => {
    // ルームIDがない場合は作成する
    if (!RoomId.value) {
        RoomId.value = uuidV4();
    }

    // ルームの実体を作成する, p2pの手法
    // FindOrCreateは同じ名前のルームがある場合はそれを使う
    context.room = await SkyWayRoom.FindOrCreate(context.ctx, {
        type: 'p2p',
        name: RoomId.value,
    });
    // ルームを作ったことを示すため
    RoomCreated.value = true
}

// 部屋に入る関数
const joinRoom = async () => {
    if (!RoomId.value) {
        alert ('No Room ID');
        return;
    }

    // ルームの実体がない場合は作成する
    if (!RoomCreated.value) {
        await createRoom();
    }

    // ルームに入る, 今は名前はランダム、同じ名前だと入らないので、現在テストため
    const member = await context.room.join({name: uuidV4()});
    // Cameraのストリームを作成する
    const videoStream = await SkyWayStreamFactory.createCameraVideoStream();

    // 映像を送る
    await member.publish(videoStream);

    // ユーザーからCameraの映像を取得する
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    // 映像を表示する
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = '100%';
    video.style.height = '100%';
    StreamArea.value.appendChild(video);

    // skywayのストリームへ添付する
    skywayStream.attach(video);
    
    // 映像を再生する
    await video.play();
}

// ページが読み込まれたら SkyWayの実体を作成する
onMounted(async () => {
    await getContext();

    // URLでルームIDがある場合はそれを使う
    RoomId.value = new URLSearchParams(window.location.search).get('room');
});

</script>

<template>
  <h1>Kaigi</h1>

  <div class="card">
    <div ref="StreamArea" v-if="RoomCreated">
        
    </div>
    <div v-else>
    
      <button @click="createRoom">Create Room</button>

        
    </div>
    <div v-if="RoomId">
        <p>以下のURLは相手とシェア:</p>
        <p>{{ baseUrl }}?room={{ RoomId }}</p>

        <p>またはルームIDを送りましょう:</p>
        <p>{{ RoomId }}</p>

        <p>会議を開始するため以下のボタンをクリックしてください:</p>
        <button @click="joinRoom">Join Room</button>

    </div>
  </div>
</template>
