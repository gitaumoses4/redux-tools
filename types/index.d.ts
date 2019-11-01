import { Action as ReduxAction, AnyAction, Reducer } from 'redux';
import { Dispatch } from 'react';

export type SagaFunction = () => IterableIterator<any>;

export type ApiResponse = {
  success: boolean;
  message?: string;
  data?: any;
  meta?: any;
};

export type ApiCall<T> = (...args: any[]) => Promise<T>;

export type ApiListener = (response: any, request: any) => void;

export interface Action extends ReduxAction {
  payload?: any;
  onSuccess?: ApiListener;
  onError?: ApiListener;
}

export type ActionCreator = (dispatch: Dispatch) => (...args: any) => Action;

export type StoreLocationResolver<T> = (state: T, action: Action) => string;

export interface WebComponentState<T> {
  fetching: boolean;
  fetched: boolean;
  submitting: boolean;
  submitted: boolean;
  data: T;
  errors: ApiError;
}

export interface ApiSagaMiddleware<T extends ApiResponse> {
  before?: (...args: Array<any>) => Array<any>;
  after?: (request: any, response: T) => void | IterableIterator<any>;
  error?: (error: ApiResponse) => void | IterableIterator<any>;
}

export type ReducerMiddleware = {
  [name: string]: ReduxReducerApiActionProps;
};

export type ReducerBuilder<T, R> = {
  initialState?: WebComponentState;
  reducers?: Array<StaticReducer<T, Action>>;
  middleware: R;
};

export interface ReduxApiActionProps<T> {
  action: string;
  api: ApiCall<T>;
  apiMiddleware?: ApiSagaMiddleware<T>;
}

export type StaticReducer<S = any, A extends Action = AnyAction> = (state: S, action: A) => S;

export interface ReduxReducerApiActionProps<R = WebComponentState<any>, T> extends ReduxApiActionProps<T> {
  reducer?: StaticReducer<R, Action>;
}

export type BuiltReducer<T> = {
  reducer: Reducer<T, Action>;
  watchers: Array<SagaFunction>;
};
