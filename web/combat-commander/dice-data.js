// Values transcribed from the white and red dice printed on the supplied card sheets.
// The rules call the second die BLACK; the supplied card artwork renders it RED.
// Deck 1 runs through these 35 outcomes twice each, in sheet order.
const PAIRS = [
  [1,1],[1,2],[2,1],[1,3],[2,2],[3,1],[1,4],[2,3],[3,2],[4,1],
  [1,5],[2,4],[3,3],[4,2],[5,1],[1,6],[2,5],[3,4],[4,3],[5,2],
  [6,1],[2,6],[3,5],[4,4],[5,3],[6,2],[3,6],[4,5],[5,4],[6,3],
  [4,6],[5,5],[6,4],[5,6],[6,5]
];
const EXTRA = {
  American:[[6,5],[6,6],[6,6],[6,5],[6,6]],
  British:[[6,6],[6,6],[6,6]],
  French:[[6,6],[6,6],[6,6]],
  German:[[6,6],[6,6],[6,6]],
  Italian:[[6,6],[6,6],[6,6]],
  Russian:[[6,6],[6,6],[6,6]]
};

export function diceForCard(nation, index) {
  if (!Number.isInteger(index) || !EXTRA[nation]) throw Error('운명 카드 정보가 올바르지 않습니다.');
  // American deck 1 cell 69 and the last cell of every deck 2 sheet are backs.
  if (nation==='American' && index===69) throw Error('미국 카드 시트의 이 칸은 카드 뒷면입니다.');
  const pair=index<70?PAIRS[Math.floor(index/2)]:EXTRA[nation][index-70];
  if (!pair) throw Error('이 카드의 주사위 값이 제공 자료에 없습니다.');
  return {white:pair[0],red:pair[1]};
}

export function faceIndices(nation) {
  if (!EXTRA[nation]) throw Error('알 수 없는 국가입니다.');
  return [...Array.from({length:nation==='American'?69:70},(_,i)=>i),
    ...Array.from({length:EXTRA[nation].length},(_,i)=>70+i)];
}
