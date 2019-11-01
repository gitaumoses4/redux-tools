import { combineReducers, Reducer, ReducersMapObject } from 'redux';
import { call, put, takeLatest } from 'redux-saga/effects';
import {
  Action, ApiCall, ApiResponse,
  ApiSagaMiddleware,
  BuiltReducer,
  ReducerBuilder,
  ReducerMiddleware,
  ReduxReducerApiActionProps,
  SagaFunction,
  StaticReducer,
  WebComponentState,
} from '../index';
import chainReducers from './chain';
import { AxiosResponse } from 'axios';
import _ from 'lodash';

export const webComponentState: WebComponentState<any> = {
  fetched: false,
  fetching: false,
  submitted: false,
  submitting: false,
  data: {},
  errors: {},
};

function simpleReducer<T>(initialState: T, actionType: string): Reducer<T, Action> {
  return (state: T = initialState, action: Action): T => {
    if (action.type === actionType) {
      return {
        ...state,
        fetched: false,
        fetching: true,
        submitted: false,
        submitting: true,
        errors: {},
      };
    } else if (action.type === `${actionType}_SUCCESS`) {
      return {
        ...state,
        fetched: true,
        fetching: false,
        submitted: true,
        submitting: false,
        data: action.payload || {},
        errors: {},
      };
    } else if (action.type === `${actionType}_FAILURE`) {
      return {
        ...state,
        fetched: false,
        fetching: false,
        submitted: true,
        submitting: false,
        errors: action.payload,
      };
    } else {
      return state;
    }
  };
}

function createReducer<T>(initialState: T, actionType: string, reducer?: Reducer<T, Action>): Reducer<T, Action> {
  const reducers = [simpleReducer(initialState, actionType)];
  if (reducer) {
    reducers.push(reducer);
  }
  return chainReducers<T>(initialState)(...reducers);
}

function createMiddleware<T extends ApiResponse = ApiResponse>(
  actionType: string,
  endpoint: ApiCall<T>,
  middleware?: ApiSagaMiddleware<T>
): SagaFunction {
  function* makeApiCall(action: Action): IterableIterator<any> {
    const payload = action.payload || {};
    let args: Array<any>;
    if (payload.constructor !== Array) {
      args = [payload];
    } else {
      args = payload;
    }
    try {
      if (middleware && middleware.before) {
        args = middleware.before(args);
      }
      const response: AxiosResponse<T> | undefined = yield call(endpoint, ...args);
      if (response) {
        let { data } = response;
        if (middleware && middleware.after) {
          const newData = yield middleware.after(args, data);
          if (newData) {
            data = newData;
          }
        }
        if (action.onSuccess) {
          action.onSuccess(data, args);
        }
        yield put({
          type: `${actionType}_SUCCESS`,
          payload: data,
        });
      }
    } catch (error) {
      let data: ApiResponse;
      if (error.response) {
        data = error.response.data;
      } else {
        data = {
          success: false,
          message: 'Server facing technical issue. Please try again!',
        };
      }
      if (middleware && middleware.error) {
        yield middleware.error(data);
      }
      if (action.onError) {
        action.onError(data, args);
      }
      yield put({
        type: `${actionType}_FAILURE`,
        payload: data,
      });
    }
  }

  function* watchForAction(): IterableIterator<any> {
    yield takeLatest(actionType, makeApiCall);
  }

  return watchForAction;
}

export function modifyReducer<T extends object>(
  location: string,
  state: T,
  action: Action,
  resolveValue: (current: any) => any
): T {
  const resolvedLocation = location;
  if (resolvedLocation) {
    const stateValue = _.get(state, resolvedLocation);
    const newState = { ...state };
    if (stateValue) {
      _.set(newState, resolvedLocation, resolveValue(stateValue));
    }
    return newState;
  }
  return state;
}

export function reducerApiAction<T extends ApiResponse>(args: {
  action: string;
  api: ApiCall<T>;
  apiMiddleware?: ApiSagaMiddleware<T>;
  reducer?: StaticReducer<WebComponentState<T>, Action>;
}): ReduxReducerApiActionProps<WebComponentState<T>, T> {
  return args;
}

type BuiltState<T> = {
  [K in keyof T]: WebComponentState<T extends ReduxReducerApiActionProps<any, any> & { api: ApiCall<infer U> } ? U : T>;
};


type ReducerObject = {
  [name: string]: BuiltReducer<any>;
};

type GeneratedReducers<T> = {
  [S in keyof T]: T extends BuiltReducer<infer U> ? U : T;
};

function generateStore<T extends ReducerObject, K extends keyof T>(reducers: T): {
  store: ReducersMapObject<GeneratedReducers<T>, any>;
  sagas: IterableIterator<any>[];
} {
  const state: any = {};
  const sagas: IterableIterator<any>[] = [];
  (Object.keys(reducers) as Array<keyof typeof reducers>).forEach(reducerName => {
    const reducer = reducers[reducerName];
    reducer.watchers.forEach(watcher => {
      sagas.push(watcher());
    });
    state[reducerName] = reducer.reducer;
  });
  return { store: state as ReducersMapObject<GeneratedReducers<T>, any>, sagas};
}

export default function reducerBuilder<T, R extends ReducerMiddleware>({
  initialState = webComponentState,
  middleware,
  reducers: stateModifiers,
}: ReducerBuilder<BuiltState<R>, R>): BuiltReducer<BuiltState<R>> {
  const reducers: ReducersMapObject = {};

  const watchers: Array<SagaFunction> = [];

  (Object.keys(middleware) as Array<keyof typeof middleware>).forEach(mName => {
    const m = middleware[mName];
    if (m.reducer) {
      reducers[mName] = createReducer<T>(initialState, m.action, m.reducer);
    }
    const watcher = createMiddleware(m.action, m.api, m.apiMiddleware);
    watchers.push(watcher);
  });

  let createdReducer = combineReducers(reducers);
  if (stateModifiers) {
    createdReducer = chainReducers(initialState)(createdReducer, ...stateModifiers);
  }
  return {
    reducer: createdReducer,
    watchers,
  };
}
