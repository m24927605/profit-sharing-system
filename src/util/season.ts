import dayjs from 'dayjs';

export const seasonMap = new Map([
  [1, { fromAt: `${dayjs(new Date).year()}-01-01`, toAt: `${dayjs(new Date).year()}-03-31` }],
  [2, { fromAt: `${dayjs(new Date).year()}-04-01`, toAt: `${dayjs(new Date).year()}-06-30` }],
  [3, { fromAt: `${dayjs(new Date).year()}-07-01`, toAt: `${dayjs(new Date).year()}-09-30` }],
  [4, { fromAt: `${dayjs(new Date).year()}-10-01`, toAt: `${dayjs(new Date).year()}-12-31` }]
]);