const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const targetModal = `<dialog id="detailModal" class="modal detail-modal">
      <div id="detailContent"></div>
    </dialog>`;

const newModal = `<dialog id="detailModal" class="modal detail-modal">
      <div id="detailContent" class="detail-scrollable"></div>
      <div id="pinnedReplyContainer" class="pinned-reply"></div>
    </dialog>`;

html = html.replace(targetModal, newModal);
fs.writeFileSync('index.html', html);
console.log('HTML updated');
