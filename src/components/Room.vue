<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } from '@skyway-sdk/room';
import { getSkyWayToken } from '../services/skywayToken';

const context = {
  ctx: null as null | SkyWayContext,
  room: null as any
};
let member: any = null;

const baseUrl = window.location.href.split('?')[0];
const RoomId = ref<string | null>(null);
const RoomCreated = ref(false);
const StreamArea = ref<HTMLDivElement | null>(null);

async function initContext(roomName: string) {
  if (context.ctx) return context.ctx;
  const { token } = await getSkyWayToken(roomName);
  context.ctx = await SkyWayContext.Create(token);
  context.ctx.onTokenUpdateReminder.add(async () => {
    try {
      const { token: newToken } = await getSkyWayToken(roomName);
      await context.ctx!.updateAuthToken(newToken);
    } catch (e) {
      console.error('token refresh failed', e);
    }
  });
  return context.ctx;
}

async function createRoom() {
  if (!RoomId.value) RoomId.value = uuidV4();
  await initContext(RoomId.value);
  context.room = await SkyWayRoom.FindOrCreate(context.ctx!, {
    type: 'sfu',
    name: RoomId.value
  });
  RoomCreated.value = true;
}

async function joinRoom() {
  if (!RoomId.value) {
    alert('No Room ID');
    return;
  }
  await initContext(RoomId.value);

  if (!RoomCreated.value) {
    context.room = await SkyWayRoom.FindOrCreate(context.ctx!, {
      type: 'sfu',
      name: RoomId.value
    });
    RoomCreated.value = true;
  }

  member = await context.room.join({ name: uuidV4() }); // 後で display name に変えてもよい

  const { audio, video } = await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();
  await member.publish(audio);
  await member.publish(video);

  // ローカル映像
  const localVideo = document.createElement('video');
  localVideo.autoplay = true;
  localVideo.playsInline = true;
  localVideo.muted = true;
  localVideo.style.width = '320px';
  localVideo.style.height = '180px';
  video.attach(localVideo);
  StreamArea.value?.appendChild(localVideo);

  // 既存 publication を subscribe (Step2)
  for (const pub of context.room.publications) {
    if (pub.publisher.id === member.id) continue;
    try {
      const { stream } = await member.subscribe(pub.id);
      if (stream.track.kind === 'video') {
        const rv = document.createElement('video');
        rv.autoplay = true; rv.playsInline = true;
        stream.attach(rv);
        StreamArea.value?.appendChild(rv);
      } else if (stream.track.kind === 'audio') {
        const ra = document.createElement('audio');
        ra.autoplay = true;
        stream.attach(ra);
        StreamArea.value?.appendChild(ra);
      }
    } catch (e) {
      console.error('subscribe fail', pub, e);
    }
  }

  console.log('Join finished (verify_jwt=true)');
}

onMounted(() => {
  RoomId.value = new URLSearchParams(window.location.search).get('room');
});
</script>

<template>
  <h1>Kaigi</h1>
  <div class="card">
    <div v-if="RoomCreated" ref="StreamArea"></div>
    <div v-else>
      <button @click="createRoom">Create Room</button>
    </div>
    <div v-if="RoomId">
      <p>共有URL: {{ baseUrl }}?room={{ RoomId }}</p>
      <button @click="joinRoom">Join Room</button>
    </div>
  </div>
</template>

<style scoped>
.card { padding:1rem; border:1px solid #ccc; max-width:720px; }
</style>