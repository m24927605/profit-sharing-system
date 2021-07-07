import dayjs from 'dayjs';

export const genSeasonDate = (date: Date) => {
  return new Map([
    [1, { fromAt: `${dayjs(date).year()}-01-01`, toAt: `${dayjs(date).year()}-03-31` }],
    [2, { fromAt: `${dayjs(date).year()}-04-01`, toAt: `${dayjs(date).year()}-06-30` }],
    [3, { fromAt: `${dayjs(date).year()}-07-01`, toAt: `${dayjs(date).year()}-09-30` }],
    [4, { fromAt: `${dayjs(date).year()}-10-01`, toAt: `${dayjs(date).year()}-12-31` }]
  ]);
};