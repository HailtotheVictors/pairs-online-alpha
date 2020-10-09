let ws = new WebSocket("ws://localhost:9090");
ws.addEventListener("close",function(){
  if (document.getElementById('criticalError').style.display != 'flex' && document.getElementById('endGameCont').style.display != 'flex') {
    setTimeout(function() { criticalError('An unknown error occurred'); }, 500);
  }
});
ws.onmessage = message => {
  const response = JSON.parse(message.data);
  console.log(response.method);
  if (response.method == 'connected') {
    clientId = response.clientId;
  } else if (response.method == 'created') {
    me = response.you;
    showLaunchScreen(response.game.joinCode);
  } else if (response.method == 'joined') {
    me = response.you;
    showLaunchScreen(document.getElementById('joinInput').value);
    document.getElementById('startGame').style.display = 'none';
    document.getElementById('joinPage').style.display = 'none';
  } else if (response.method == 'playerupdate') {
    updatePlayerTabs(response.players);
  } else if (response.method == 'renamed') {
    me = response.you;
  } else if (response.method == 'error') {
    error(response.text);
  } else if (response.method == 'criticalerror') {
    criticalError(response.text);
  } else if (response.method == 'launched') {
    turn = response.turn;
    launchGame();
    let scores = document.getElementsByClassName('playerScore');
    for (let div of scores) {
      div.textContent = '-2PTS';
    }
  } else if (response.method == 'dealt') {
    hand = hand.concat(response.cards);
    for (let card of response.cards) {
      createCard(card,useSuit,document.getElementsByClassName('cardHalf')[1]);
    }
  } else if (response.method == 'tablecards') {
    for (let card of response.cards) {
      createCard(card,useSuit,document.getElementsByClassName('cardHalf')[0]);
    }
  } else if (response.method == 'nextturn') {
    resetCards();
    changeTurn(response.player);
  } else if (response.method == 'message') {
    document.getElementById('message').textContent = response.message;
  } else if (response.method == 'removedraw') {
    document.getElementById('actionCont').children[0].remove();
    document.getElementById('message').textContent = 'There are no more cards in the draw pile';
  } else if (response.method == 'removefromhand') {
    for (let card of response.cards) {
      hand = bubble(hand,card);
    }
    removeCards(response.cards,document.getElementsByClassName('cardHalf')[1]);
  } else if (response.method == 'removefromtable') {
    removeCards(response.cards,document.getElementsByClassName('cardHalf')[0]);
  } else if (response.method == 'scoreupdate') {
    updateScore(response.scores);
  } else if (response.method == 'endofgame') {
    endGame(response);
  } else {
    console.log(response);
  }
}

var clientId;
var useSuit = false;
var cycleInterval = false;
var carousel = 0;
var me;
var gameLaunched = false;
var opponents;
var hand = [];
var turn;
var primed = false;
var selected = [];
var challenge = {player:undefined,value:undefined};
var steal = {firstCard:undefined,name:undefined};
var oppoSets = [];

function endGame(data) {
  document.getElementById('endGameCont').style.display = 'flex';
  document.getElementById('endGameMess').textContent = data.message;
  for (let info of data.scores) {
    let newRow = document.createElement('DIV');
    newRow.classList.add('finalScoreCont');
    let newName = document.createElement('DIV');
    newName.textContent = info.name;
    newName.style.backgroundColor = `var(--player${info.index})`;
    newName.classList.add('finalScoreName');
    let newNum = document.createElement('DIV');
    newNum.classList.add('finalScoreNumber');
    newNum.textContent = info.score + plural('PT',info.score);
    newNum.style.color = `var(--player${info.index})`;
    newRow.append(newName);
    newRow.append(newNum);
    document.getElementById('endGameScores').append(newRow);
  }
}

function cyclePlayers() {
  if (cycleInterval === false) {
    cycleInterval = setInterval(function() {
      carousel++;
      var tabs = document.getElementsByClassName('playerScoreCont');
      var players = document.getElementsByClassName('playerTab');
      if (carousel >= tabs.length) {
        carousel = 0;
      }
      for (let i = 0; i < tabs.length; i++) {
        if (i == carousel) {
          tabs[i].style.display = 'flex';
          players[i].style.borderTopColor = 'currentColor';
        } else {
          tabs[i].style.display = 'none';
          players[i].style.borderTopColor = '#777';
        }
      }
    }, 7000);
  }
}

function goToPlayer(num) {
  num = Number(num);
  carousel = num;
  clearInterval(cycleInterval);
  cycleInterval = false;
  var tabs = document.getElementsByClassName('playerScoreCont');
  var players = document.getElementsByClassName('playerTab');
  for (let i = 0; i < tabs.length; i++) {
    if (i == num) {
      tabs[i].style.display = 'flex';
      players[i].style.borderTopColor = 'currentColor';
    } else {
      tabs[i].style.display = 'none';
      players[i].style.borderTopColor = '#777';
    }
  }
  setTimeout(cyclePlayers,5000);
}

function launchGame() {
  gameLaunched = true;
  document.getElementById('startGameCont').style.display = 'none';
  updatePlayerTabs(opponents);
  if (turn != me.name) {
    for (let btn of document.getElementsByClassName('playButton')) {
      btn.classList.add('disabled');
    }
    document.getElementsByClassName('confirmButton')[0].classList.add('disabled');
  }
  setTimeout(cyclePlayers,3000);
}

function requestLaunch() {
  let payLoad = {
    method: 'launch',
    clientId: clientId
  }
  ws.send(JSON.stringify(payLoad));
}

function requestGame() {
  let payLoad = {
    method: 'create',
    clientId: clientId
  };
  ws.send(JSON.stringify(payLoad));
}

function showLaunchScreen(join) {
  document.getElementById('initPage').style.display = 'none';
  document.getElementById('launchPage').style.display = 'block';
  document.getElementById('joinCode').textContent = `Join Code: ${join}`;
  document.getElementById('nameChange').value = me.name;
}

function showJoinScreen() {
  document.getElementById('joinInput').value = '';
  document.getElementById('initPage').style.display = 'none';
  document.getElementById('joinPage').style.display = 'block';
  document.getElementById('joinInput').focus();
}

function askToJoin() {
  var val = document.getElementById('joinInput').value;
  if (String(val).length == 6) {
    let payLoad = {
      method: 'join',
      joinCode: Number(val),
      clientId: clientId
    }
    setTimeout(function() {
      ws.send(JSON.stringify(payLoad));
    }, 300);
  } else if (String(val).length > 6) {
    document.getElementById('joinInput').value = String(val.substring(0,6));
  }
}

function updatePlayerTabs(players) {
  opponents = players;
  if (gameLaunched) {
    let carouselParent = document.getElementById('playerCarousel')
    carouselParent.innerHTML = '';
    let scoreParent = document.getElementById('playerScores');
    scoreParent.innerHTML = '';
    for (let player in players) {
      let newTab = document.createElement('DIV');
      newTab.addEventListener('click',function() { goToPlayer(player) });
      newTab.classList.add('playerTab');
      if (players[player].name == turn) {
        newTab.textContent = decodeEntities(players[player].name + ' &middot;');
      } else {
        newTab.textContent = players[player].name;
      }
      if (players[player].name == me.name) {
        newTab.style.textDecoration = 'underline';
      }
      if (player == carousel) {
        newTab.style.borderTopColor = 'currentColor';
      }
      carouselParent.append(newTab);
      let newScore = document.createElement('DIV');
      newScore.classList.add('playerScoreCont');
      if (player == carousel) {
        newScore.style.display = 'flex';
      }
      let newNumScore = document.createElement('DIV');
      newNumScore.classList.add('playerScore');
      //newNumScore.textContent = players[player].score + plural('PT',players[player].score);
      let newSetCont = document.createElement('DIV');
      newSetCont.classList.add('playerSets');
      newScore.append(newNumScore);
      newScore.append(newSetCont);
      scoreParent.append(newScore);
    }
    updateScore(players);
  } else {
    let tab = document.getElementById('joinedPlayers').children;
    for (let i = 0; i < players.length; i++) {
      tab[i].textContent = players[i].name;
      tab[i].style.display = 'block';
    }
    for (let i = players.length; i < 6; i++) {
      tab[i].style.display = 'none';
    }
  }
}

function updateScore(players) {
  let parents = document.getElementsByClassName('playerScoreCont');
  oppoSets.length = 0;
  for (let i = 0; i < parents.length; i++) {
    parents[i].children[0].textContent = `${players[i].score}${plural('PT',players[i].score)}`;
    parents[i].children[1].innerHTML = '';
    let newSets = {name:players[i].name,sets:players[i].inSet};
    oppoSets.push(newSets);
    for (let sets of players[i].inSet) {
      let newSVG = document.createElementNS('http://www.w3.org/2000/svg','svg');
      newSVG.setAttribute('viewBox','0 0 24 24');
      newSVG.style.fill = cardColors[sets[0] % 13];
      let newPath = document.createElementNS('http://www.w3.org/2000/svg','path');
      newPath.setAttribute('d',cardIcons[sets[0] % 13]);
      newSVG.append(newPath);
      parents[i].children[1].append(newSVG);
      newSpan = document.createElement('SPAN');
      newSpan.textContent = decodeEntities(`&times;${sets.length}`);
      parents[i].children[1].append(newSpan);
    }
  }
}

function requestRename() {
  let newName = document.getElementById('nameChange').value;
  if (newName.length > 12) {
    error('Name cannot be longer than 12 characters');
  } else {
    let payLoad = {
      method: 'rename',
      newName: newName,
      clientId: clientId
    };
    ws.send(JSON.stringify(payLoad));
  }
}

function requestDraw() {
  if (document.getElementsByClassName('cardHalf')[1].children.length >= 7) {
    error('You cannot draw with 6 or more cards in hand.');
    return;
  }
  let payLoad = {
    method: 'draw',
    clientId: clientId
  };
  ws.send(JSON.stringify(payLoad));
}

function changeTurn(player) {
  challenge.player = undefined;
  challenge.value = undefined;
  steal.firstCard = undefined;
  steal.name = undefined;
  primed = false;
  document.getElementById('challengeCont').style.display = 'none';
  document.getElementById('stealCont').style.display = 'none';
  let tabs = document.getElementsByClassName('playerTab');
  for (let person in opponents) {
    if (opponents[person].name == player) {
      tabs[person].textContent = decodeEntities(opponents[person].name + ' &middot;');
    } else {
      tabs[person].textContent = opponents[person].name;
    }
  }
  turn = player;
  if (turn != me.name) {
    for (let btn of document.getElementsByClassName('playButton')) {
      btn.classList.add('disabled');
    }
    document.getElementsByClassName('confirmButton')[0].classList.add('disabled');
  } else {
    for (let btn of document.getElementsByClassName('playButton')) {
      btn.classList.remove('disabled');
    }
    if (hand.length >= 7) {
      document.getElementsByClassName('playButton')[0].classList.add('disabled');
    }
  }
}

function prime(str) {
  document.getElementsByClassName('confirmButton')[0].classList.remove('disabled');
  primed = str;
  if (turn != me.name) {
    error('It is not your turn.');
    return;
  }
  let prompt;
  document.getElementById('challengeCont').style.display = 'none';
  document.getElementById('stealCont').style.display = 'none';
  switch (str) {
    case 'takeplay':
      prompt = 'Choose at least two cards on screen, then press confirm.';
      break;
    case 'challenge':
      prompt = 'Choose who and for what card to challenge, then press confirm.';
      document.getElementById('challengeCont').style.display = 'block';
      goToChallenge();
      break;
    case 'steal':
      prompt = 'Choose another player\'s set to steal, then press confirm.';
      document.getElementById('stealCont').style.display = 'block';
      goToSteal();
      break;
    default:
      prompt = 'WTF';
      break;
  }
  document.getElementById('message').textContent = prompt;
}

function goToSteal() {
  let parent = document.getElementById('stealFlex');
  parent.innerHTML = '';
  let handValues = [];
  for (let card of hand) {
    handValues.push(card % 13);
  }
  for (let obj of oppoSets) {
    /*if (obj.name == me.name) {
      continue;
    }*/
    let div = document.createElement('DIV');
    let nameCard = document.createElement('SPAN');
    nameCard.textContent = obj.name;
    div.append(nameCard);
    parent.append(div);
    for (let group of obj.sets) {
      let value = group[0] % 13;
      if (handValues.includes(value) == false) {
        continue;
      }
      let newRow = document.createElement('DIV');
      newRow.classList.add('stealRow');
      let newBox = document.createElement('DIV');
      newBox.setAttribute('data-first',group[0]);
      newBox.setAttribute('data-name',obj.name);
      newBox.classList.add('stealBox');
      newBox.addEventListener('click',function() { selectSteal(this); } );
      newBox.style.color = cardColors[value];
      let newSVG = document.createElementNS('http://www.w3.org/2000/svg','svg');
      newSVG.setAttribute('viewBox','0 0 24 24');
      let newPath = document.createElementNS('http://www.w3.org/2000/svg','path');
      newPath.setAttribute('d',cardIcons[value]);
      newSVG.append(newPath);
      let newQuan = document.createElement('DIV');
      newQuan.textContent = decodeEntities(`&times;${group.length}`);
      newBox.append(newSVG);
      newBox.append(newQuan);
      newRow.append(newBox);
      div.append(newRow);
    }
  }
}

function goToChallenge() {
  let rows = document.getElementsByClassName('challengeRow');
  rows[0].innerHTML = '';
  rows[1].innerHTML = '';
  //add opponents
  for (let person of opponents) {
    if (person.name == me.name) {
      continue;
    }
    let newOption = document.createElement('DIV');
    newOption.textContent = person.name;
    newOption.addEventListener('click',function() { selectChallenge(0,this); } );
    rows[0].append(newOption);
  }
  //add card in hand
  for (let card of document.getElementsByClassName('cardHalf')[1].children) {
    if (!card.classList.contains('card')) {
      continue;
    }
    let value = Number(card.getAttribute('data-value'));
    let newSVG = document.createElementNS('http://www.w3.org/2000/svg','svg');
    newSVG.style.fill = cardColors[value];
    newSVG.setAttribute('data-value',value);
    newSVG.setAttribute('viewBox','0 0 24 24');
    newSVG.addEventListener('click',function() { selectChallenge(1,this); } )
    let newPath = document.createElementNS('http://www.w3.org/2000/svg','path');
    newPath.setAttribute('d',cardIcons[value]);
    newSVG.append(newPath);
    rows[1].append(newSVG);
  }
}

function selectChallenge(num,elem) {
  let parent = document.getElementsByClassName('challengeRow')[num];
  for (let div of parent.children) {
    div.classList.remove('selected');
  }
  elem.classList.add('selected');
  if (num === 0) {
    challenge.player = elem.textContent;
  } else {
    challenge.value = Number(elem.getAttribute('data-value'));
  }
}

function selectSteal(elem) {
  let choices = document.getElementsByClassName('stealBox');
  for (let div of choices) {
    div.classList.remove('selected');
  }
  elem.classList.add('selected');
  steal.firstCard = Number(elem.getAttribute('data-first'));
  steal.name = elem.getAttribute('data-name');
}

function resetCards() {
  selected.length = 0;
  primed = false;
  for (let card of document.getElementsByClassName('cardHalf')[0].children) {
    card.style.border = 'none';
    card.setAttribute('data-selected','false');
  }
  for (let card of document.getElementsByClassName('cardHalf')[1].children) {
    card.style.border = 'none';
    card.setAttribute('data-selected','false');
  }
}

function selectCard(elem) {
  if (primed == false || turn != me.name) {
    return;
  }
  if (elem.getAttribute('data-selected') == 'false' && selected.length == 0) {
    elem.setAttribute('data-selected','true');
    elem.style.border = '2px solid white';
    selected.push(Number(elem.getAttribute('data-id')));
  } else if (elem.getAttribute('data-selected') == 'false') { //check that card matches others
    if (Number(elem.getAttribute('data-value')) == selected[0] % 13) {
      elem.setAttribute('data-selected','true');
      elem.style.border = '2px solid white';
      selected.push(Number(elem.getAttribute('data-id')));
    } else {
      error('Cards must match');
    }
  } else {
    elem.setAttribute('data-selected','false');
    elem.style.border = 'none';
    selected = bubble(selected,Number(elem.getAttribute('data-id')));
  }
}

function confirmPlay() {
  if (primed == 'takeplay') {
    sendPair();
  } else if (primed == 'challenge') {
    challengeForCard();
  } else if (primed == 'steal') {
    stealSet();
  }
}

function sendPair() {
  if (selected.length < 2) {
    error('Select at least two cards');
    return;
  }
  let payLoad = {
    method: 'makeset',
    newset: selected,
    clientId: clientId
  }
  ws.send(JSON.stringify(payLoad));
}

function challengeForCard() {
  if (challenge.player == undefined) {
    error('Choose a player to challenge');
    return;
  } else if (challenge.value == undefined) {
    error('Choose a card to challenge for');
    return;
  }
  let payLoad = {
    method: 'challenge',
    player: challenge.player,
    card: challenge.value,
    clientId: clientId
  };
  ws.send(JSON.stringify(payLoad));
}

function stealSet() {
  if (steal.firstCard == undefined || steal.name == undefined) {
    error('Choose a set to steal');
    return;
  }
  let payLoad = {
    method: 'steal',
    name: steal.name,
    card: steal.firstCard,
    clientId: clientId
  };
  ws.send(JSON.stringify(payLoad));
}

function removeCards(cards,parent) {
  for (let values of cards) {
    for (let cards of parent.children) {
      if (Number(cards.getAttribute('data-id')) == values) {
        cards.remove();
      }
    }
  }
  checkCardOverflow();
}

//card stuff

function randomCard() {
  let randomCard = Math.floor(Math.random() * 52);
  createCard(randomCard,useSuit,document.getElementsByClassName('cardHalf')[0]);
}

function createCard(num,suit,parent) {
  let card = document.createElement('div');
  card.classList.add('card');
  card.setAttribute('data-value',num % 13);
  card.setAttribute('data-suit',Math.floor(num / 13));
  card.setAttribute('data-id',num);
  card.setAttribute('data-selected','false');
  card.addEventListener('click',function() { selectCard(this) });
  //value svg
  let value = document.createElementNS('http://www.w3.org/2000/svg','svg');
  value.setAttribute('viewBox','0 0 24 24');
  value.classList.add('cardValue');
  let path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',cardIcons[num % 13]);
  value.append(path);
  card.append(value);
  if (suit === false) {
    value.style.fill = cardColors[num % 13];
  } else if (Math.floor(num / 13) < 2) {
    value.style.fill = 'rgb(255,30,30)';
  } else {
    value.style.fill = 'white';
  }
  //add suit if needed
  if (suit === true) {
    for (let i = 0; i < 2; i++) {
      let suitIcon = document.createElementNS('http://www.w3.org/2000/svg','svg');
      suitIcon.classList.add('cardSuit');
      suitIcon.setAttribute('viewBox','0 0 24 24');
      let suitPath = document.createElementNS('http://www.w3.org/2000/svg','path');
      suitPath.setAttribute('d',suits[Math.floor(num / 13)]);
      if (Math.floor(num / 13) < 2) {
        suitIcon.style.fill = 'rgb(255,30,30)';
      } else {
        suitIcon.style.fill = 'white';
      }
      suitIcon.append(suitPath);
      card.append(suitIcon);
    }
  }
  //return new card
  var index = 0;
  for (let card of parent.children) {
    if (card != parent.lastElementChild) {
      var nextValue = Number(card.getAttribute('data-value'));
      if (nextValue > num % 13) {
        break;
      } else {
        index++;
      }
    }
  }
  //parent.prepend(card);
  if (parent.children.length > 1) {
    parent.insertBefore(card,parent.children[index]);
  } else {
    parent.prepend(card);
  }
  checkCardOverflow();
}

//resources

function plural(str,quan) {
  if (quan == 1) {
    return str;
  } else {
    return str + 'S';
  }
}

function error(str) {
  let div = document.getElementById('error');
  div.style.display = 'flex';
  div.children[0].textContent = str;
  setTimeout(function() {
    div.style.display = 'none';
  }, 2500);
}

function criticalError(str) {
  document.getElementById('criticalError').style.display = 'flex';
  document.getElementById('criticalError').children[0].textContent = str;
}

function checkCardOverflow() {
  var rows = document.getElementsByClassName('cardHalf');
  for (let div of rows) {
    if (div.scrollWidth > div.clientWidth) {
      console.log('change');
      div.style.justifyContent = 'flex-start';
      div.lastElementChild.style.display = 'block';
    } else {
      div.style.justifyContent = 'space-evenly';
      div.lastElementChild.style.display = 'none';
    }
  }
}

function bubble(arr,term) {
  if (arr.indexOf(term) == -1) {
    return arr;
  } else {
    let a = arr.indexOf(term);
    let f = arr.slice(0,a);
    let g = arr.slice(a + 1,arr.length);
    f = f.concat(g);
    arr = f;
    return f;
  }
}

var decodeEntities = (function() {
  var element = document.createElement('div');
  function decodeHTMLEntities (str) {
    if(str && typeof str === 'string') {
      str = str.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
      str = str.replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gmi, '');
      element.innerHTML = str;
      str = element.textContent;
      element.textContent = '';
    }
    return str;
  }
  return decodeHTMLEntities;
})();
