import { Action } from '../index';
import { Reducer } from 'redux';

function chainReducers<T>(initialState: T): ChainReducers {
  return (...reducers: Reducer[]): Reducer => {
    return (state: T = initialState, action: Action): T => {
      return reducers.reduce((acc: T, cur: Reducer): T => {
        return cur(acc, action);
      }, state);
    };
  };
}

type ChainReducers = (...reducers: Reducer[]) => Reducer;

export default chainReducers;
