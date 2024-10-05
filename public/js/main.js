const createUserBtn = document.getElementById("create-user");
const username = document.getElementById("username");
const allusersHtml = document.getElementById("allusers");
const remoteVideo = document.getElementById("remoteVideo");
const remoteAudio = document.getElementById("remoteAudio");
const endCallBtn = document.getElementById("end-call-btn");
const videoToggle = document.getElementById("video-toggle");
const NotificationPlayer = document.getElementById("notificationPlayer");
const DisconnectedPlayer = document.getElementById("disconnectedPlayer");
const answerButton = document.getElementById("answerCall");
const declineButton = document.getElementById("declineCall");
const socket = io();
let localStream;
let caller = [];

// Single Method for peer connection
const PeerConnection = (function () {
  let peerConnection;

  const createPeerConnection = () => {
    const config = {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    };
    peerConnection = new RTCPeerConnection(config);
    // add local stream to peer connection
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    // listen to remote stream and add to peer connection
    peerConnection.ontrack = function (event) {
      console.log("event", event.streams);
      const Rvideo = document.createElement("video");
      Rvideo.setAttribute("playsinline", true);
      //   Rvideo.setAttribute("muted", true);
      Rvideo.setAttribute("autoplay", true);
      Rvideo.setAttribute("id", `${event.streams[0].id}`);
      Rvideo.classList.add("remote-video");
      container = document.getElementById("remote-video-container");
      if (!document.getElementById(`${event.streams[0].id}`)) {
        container.appendChild(Rvideo);
      }

      Rvideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = function (event) {
      if (event.candidate) {
        socket.emit("icecandidate", event.candidate);
      }
    };

    return peerConnection;
  };

  return {
    getInstance: () => {
      if (!peerConnection) {
        peerConnection = createPeerConnection();
      }
      return peerConnection;
    },
  };
})();

// handle browser events
createUserBtn.addEventListener("click", async (e) => {
  if (username.value !== "") {
    await createLocalVideo();

    const usernameContainer = document.querySelector(".username-input");

    socket.emit("join-user", username.value);
    usernameContainer.style.display = "none";
  }
});
endCallBtn.addEventListener("click", (e) => {
  socket.emit("call-ended", caller);
});

// handle socket events
socket.on("joined", (allusers) => {
  const createUsersHtml = () => {
    allusersHtml.innerHTML = "";

    for (const user in allusers) {
      const li = document.createElement("li");
      li.textContent = `${user} ${user === username.value ? "(You)" : ""}`;

      if (user !== username.value) {
        const button = document.createElement("button");
        button.classList.add("call-btn");
        button.addEventListener("click", (e) => {
          startCall(user);
        });
        const img = document.createElement("img");
        img.setAttribute("src", "/images/phone.png");
        img.setAttribute("width", 20);
        button.appendChild(img);
        li.appendChild(button);
      }

      allusersHtml.appendChild(li);
    }
  };

  createUsersHtml();
});

socket.on("offer", async ({ from, to, offer }) => {
  NotificationPlayer.loop = true;
  NotificationPlayer.volume = 0.5;
  NotificationPlayer.play();
  notifyMe({ callerName: `${from}` });
  answerButton.addEventListener("click", () => {
    NotificationPlayer.pause();
    answerCall({ from, to, offer });
  });
  declineButton.addEventListener("click", () => {
    NotificationPlayer.pause();
    endCall();
  });
  answerButton.classList.remove("d-none");
  declineButton.classList.remove("d-none");
});
socket.on("answer", async ({ from, to, answer }) => {
  const pc = PeerConnection.getInstance();
  await pc.setRemoteDescription(answer);
  endCallBtn.style.display = "block";
  socket.emit("end-call", { from, to });
  caller = [from, to];
});
socket.on("icecandidate", async (candidate) => {
  console.log({ candidate });
  const pc = PeerConnection.getInstance();
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
});
socket.on("end-call", ({ from, to }) => {
  endCallBtn.style.display = "block";
});
socket.on("call-ended", (caller) => {
  DisconnectedPlayer.play();
  endCall();
});
socket.on("user-disconnected", (username) => {
  console.log(`${username} has disconnected.`);

  // Remove the user from the displayed user list
  const userListItems = document.querySelectorAll("li");
  userListItems.forEach((item) => {
    if (item.textContent.includes(username)) {
      item.remove();
    }
  });
});

// Function to handle user disconnection
const handleUserDisconnect = async () => {
  console.log("user-disconnected");
  await socket.emit("user-disconnected", username.value);
};

// // Add an event listener for the beforeunload event
// window.addEventListener("beforeunload", async (event) => {
//   await handleUserDisconnect();
//   event.preventDefault();
// });

// Answer Call
const answerCall = async ({ from, to, offer }) => {
  const pc = PeerConnection.getInstance();
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { from, to, answer: pc.localDescription });
  answerButton.classList.add("d-none");
  declineButton.classList.add("d-none");
  caller = [from, to];
};

// start call method
const startCall = async (user) => {
  console.log("user>", { user });
  const pc = PeerConnection.getInstance();
  const offer = await pc.createOffer();
  console.log("offer", { offer });
  await pc.setLocalDescription(offer);
  socket.emit("offer", {
    from: username.value,
    to: user,
    offer: pc.localDescription,
  });
};

const endCall = () => {
  const pc = PeerConnection.getInstance();
  if (pc) {
    pc.close();
    endCallBtn.style.display = "none";
    declineButton.classList.add("d-none");
    answerButton.classList.add("d-none");
    document.querySelectorAll(".remote-video").forEach((el) => el.remove());
  }
};

// initialize app
const startMyVideo = async (video) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    console.log({ stream });
    localStream = stream;
    video.srcObject = stream;

    video.muted = true;
    video.setAttribute("playsinline", true);
    video.setAttribute("autoplay", true);
    video.setAttribute("muted", true);

    videoToggle.children[0].classList.add("fa-video-slash");

    return true;
  } catch (error) {
    console.log({ error });
    return false;
  }
};

// Create Local Video
const createLocalVideo = async () => {
  try {
    const video = document.createElement("video");
    video.setAttribute("playsinline", true);
    video.setAttribute("muted", true);
    video.setAttribute("autoplay", true);
    video.setAttribute("id", "localVideo");
    container = document.getElementById("local-video-container");
    // container.setAttribute("draggable", true);
    container.appendChild(video);
    return startMyVideo(video);
  } catch (error) {
    console.log({ error });
  }
};

// Video Toggle
videoToggle.addEventListener("click", (e) => {
  if (localStream.getVideoTracks()[0].enabled) {
    localStream.getVideoTracks()[0].enabled = false;
    videoToggle.children[0].classList.remove("fa-video-slash");
    videoToggle.children[0].classList.add("fa-video");
  } else {
    localStream.getVideoTracks()[0].enabled = true;
    videoToggle.children[0].classList.add("fa-video-slash");
    videoToggle.children[0].classList.remove("fa-video");
  }
});
