/**
 * Created by quelves on 10/18/16.
 */
import { Mongo } from 'meteor/mongo';

export const Chats = new Mongo.Collection('chats');
export const Messages = new Mongo.Collection('messages');


