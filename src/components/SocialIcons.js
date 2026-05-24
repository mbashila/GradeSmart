import React from 'react';
import { Image } from 'react-native';

const googleImg = require('../../images/google.png');
const appleImg = require('../../images/apple-logo.png');
const facebookImg = require('../../images/facebook.png');

export function GoogleIcon({ size = 22 }) {
  return (
    <Image source={googleImg} style={{ width: size, height: size }} resizeMode="contain" />
  );
}

export function AppleIcon({ size = 22 }) {
  return (
    <Image source={appleImg} style={{ width: size, height: size }} resizeMode="contain" />
  );
}

export function FacebookIcon({ size = 22 }) {
  return (
    <Image source={facebookImg} style={{ width: size, height: size }} resizeMode="contain" />
  );
}
