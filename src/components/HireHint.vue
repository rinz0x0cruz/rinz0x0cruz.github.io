<template>
  <span class="hire-hint" aria-hidden="true">
    <svg
      class="hire-hint__arrow"
      viewBox="0 0 132 58"
      width="62"
      height="27.24"
      focusable="false"
    >
      <path d="M124 14 C94.69331752471626 2.330235578492284, 47.80160940103233 3.8873972315341234, 14.70124078206718 31.793791164830328 M123.95176338367165 13.170293213799596 C94.29136442357674 0.8420904729329051, 46.68921894425526 6.477658145781606, 18.637281818334014 34.630652801152316 M29.514608666626312 30.970803561209898 C25.401566530361347 30.496373909922706, 23.774612654740537 32.293176277344216, 17.35638210120595 33.03444948502832 M28.71409127781664 29.93092239973378 C26.370427771691315 31.483163172006904, 23.041975050091065 31.934464614297063, 17.026537152436994 34.02525315249018 M17.33020970698564 34.75480542401167 C17.46270379513683 32.02922310557962, 18.652567055079384 27.6281611295298, 20.615312945564614 21.475931681864928 M17.42893248304528 33.556705986776464 C17.79104255999881 31.822336986074536, 19.01818904864849 28.11646400731591, 21.51192588698626 21.220419025913472" />
    </svg>
    <span class="hire-hint__label">work + contact</span>
  </span>
</template>

<style>
.hire-hint {
  position: absolute;
  z-index: 7;
  top: 0;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--accent);
  pointer-events: none;
  transform: translate(calc(100% + 0.6rem), calc(-100% - 0.78rem)) rotate(7deg);
}

.hire-hint__arrow path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.hire-hint__label {
  font-family: 'Caveat Note', 'Danviska', cursive;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

@media (max-width: 1199px) {
  .hire-hint {
    display: none;
  }
}
</style>