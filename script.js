// ===== 初期データ =====
const categories = ["交通費","食費","雑貨","宿泊費","その他"];

let members = JSON.parse(localStorage.getItem("members")) || [];
let payments = JSON.parse(localStorage.getItem("payments")) || [];
let settlementChecks = JSON.parse(localStorage.getItem("settlementChecks")) || {};

let editIndex = null;



// ===== 保存 =====
function save() {
  localStorage.setItem("members", JSON.stringify(members));
  localStorage.setItem("payments", JSON.stringify(payments));
  localStorage.setItem("settlementChecks", JSON.stringify(settlementChecks));
}

// ===== データ補正 =====
function normalizeMembers() {
  members = members.map(m => {

    // 旧形式（文字列）
    if (typeof m === "string") {
      const categoryFlags = {};
      categories.forEach(c => categoryFlags[c] = true);

      return {
        name: m,
        categories: categoryFlags
      };
    }

    // categoriesが無い場合
    if (!m.categories) {
      const categoryFlags = {};
      categories.forEach(c => categoryFlags[c] = true);
      m.categories = categoryFlags;
    }

    // カテゴリ不足補完
    categories.forEach(c => {
      if (m.categories[c] === undefined) {
        m.categories[c] = true;
      }
    });

    return m;
  });

  save();
}

// ===== Enterでメンバー追加 =====
document.getElementById("memberName").addEventListener("keypress", e => {
  if (e.key === "Enter") addMember();
});

// メンバー追加
function addMember() {
  const name = document.getElementById("memberName").value.trim();
  if (!name) return;

  members.push({
    name,
    transport: true // ← 交通費だけ
  });

  document.getElementById("memberName").value = "";

  save();
  renderMembers();
}

// ===== メンバー削除 =====
function deleteMember(i) {
  members.splice(i,1);
  save();
  renderMembers();
  calculate();
}

// ===== 交通費参加切替 =====
function toggleTransport(index, value){
  members[index].transport = value;
  save();
  calculate();
}

// ===== 清算済み切替 =====
function toggleSettlement(name, checked) {
  settlementChecks[name] = checked;
  save();
  calculate();
}

// ===== メンバー描画 =====
function renderMembers() {
  const list = document.getElementById("memberList");
  const payer = document.getElementById("payer");
  const editPayer = document.getElementById("editPayer");

  list.innerHTML = "";
  payer.innerHTML = "";
  editPayer.innerHTML = "";

  members.forEach((m,i)=>{

    const li = document.createElement("li");
    li.className = "member-item";
    li.innerHTML = `
      <div>
        <strong>${m.name}</strong>
        <div style="font-size:12px">
          <label>
            <input type="checkbox"
              ${m.transport ? "checked" : ""}
              onchange="toggleTransport(${i}, this.checked)">
            交通費支払義務
          </label>
        </div>
      </div>
      <button class="icon-btn" onclick="deleteMember(${i})">×</button>
    `;
    list.appendChild(li);

    [payer, editPayer].forEach(sel=>{
      const opt = document.createElement("option");
      opt.value = m.name;
      opt.textContent = m.name;
      sel.appendChild(opt);
    });
  });
}

// ===== 支払い追加 =====
function addPayment() {
  const data = {
    category: document.getElementById("category").value,
    title: document.getElementById("title").value,
    amount: parseFloat(document.getElementById("amount").value),
    payer: document.getElementById("payer").value
  };

  if (!data.title || !data.amount) return;

  payments.push(data);

  document.getElementById("title").value = "";
  document.getElementById("amount").value = "";

  save();
  renderHistory();
  calculate();
}

// ===== 履歴描画 =====
function renderHistory() {
  const history = document.getElementById("history");
  history.innerHTML = "";

  payments.forEach((p,i)=>{
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <div class="card-text">
        [${p.category}] ${p.title}：${p.amount}円（${p.payer}）
      </div>
      <div class="card-actions">
        <button class="icon-btn edit-btn" onclick="openModal(${i})">✎</button>
        <button class="icon-btn" onclick="deletePayment(${i})">×</button>
      </div>
    `;

    history.appendChild(div);
  });
}

// ===== 支払い削除 =====
function deletePayment(i){
  payments.splice(i,1);
  save();
  renderHistory();
  calculate();
}

// ===== モーダル開く =====
function openModal(i){
  editIndex = i;
  const p = payments[i];

  document.getElementById("modal").classList.remove("hidden");

  document.getElementById("editCategory").innerHTML =
    categories.map(c=>`<option ${c===p.category?'selected':''}>${c}</option>`).join("");

  document.getElementById("editTitle").value = p.title;
  document.getElementById("editAmount").value = p.amount;
  document.getElementById("editPayer").value = p.payer;
}

// ===== 編集保存 =====
function saveEdit(){
  payments[editIndex] = {
    category: document.getElementById("editCategory").value,
    title: document.getElementById("editTitle").value,
    amount: parseFloat(document.getElementById("editAmount").value),
    payer: document.getElementById("editPayer").value
  };

  closeModal();
  save();
  renderHistory();
  calculate();
}

// ===== モーダル閉じる =====
function closeModal(){
  document.getElementById("modal").classList.add("hidden");
}

// ===== 計算 =====
function calculate(){
  const balance = {};
  let total = 0;

  members.forEach(m => balance[m.name] = 0);

  payments.forEach(p=>{
    total += p.amount;

    let participants;

    // 👇 交通費だけ特別処理
    if (p.category === "交通費") {
      participants = members.filter(m => m.transport);
    } else {
      participants = members; // 全員参加
    }

    if (participants.length === 0) return;

    const share = Math.ceil(p.amount / participants.length);

    participants.forEach(m=>{
      balance[m.name] -= share;
    });

    balance[p.payer] += p.amount;
  });

  document.getElementById("total").textContent = total + "円";

  const result = document.getElementById("result");
  result.innerHTML = "";

  Object.entries(balance).forEach(([name,val])=>{
    const div = document.createElement("div");
    div.className = "result-item";

    // チェック状態
    const isChecked = settlementChecks[name];

    if (isChecked) {
      div.classList.add("done");
    }

    div.innerHTML = `
      <div class="result-row">
        <div>
          ${name}：
          <span style="color:${val>=0?'#2e7d32':'#c62828'}">
            ${val>=0?'+':''}${Math.round(val)}円
          </span>
        </div>
        <input type="checkbox"
          ${isChecked ? "checked" : ""}
          onchange="toggleSettlement('${name}', this.checked)">
      </div>
    `;

    result.appendChild(div);
  });
}

// ===== 初期化 =====
normalizeMembers();
renderMembers();
renderHistory();
calculate();
