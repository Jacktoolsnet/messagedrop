import{createCoinToss,flipCoin}from'./coin-toss';
describe('coin toss',()=>{it('stores a single random result',()=>{const game=createCoinToss('a','b','Burger','Pizza'),next=flipCoin(game,'b',()=>.8)!;expect(next.result).toBe('B');expect(next.status).toBe('decided');expect(flipCoin(next,'b',()=>0)).toBeNull()});});
