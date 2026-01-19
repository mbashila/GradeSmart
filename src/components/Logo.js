import React from "react";
import { View, StyleSheet, Image, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

export default function Logo({ size = "large", align = "center", style }) {
  const isLarge = size === "large";
  const isNavbar = size === "navbar";
  const isAuth = size === "auth";
  const isWelcome = size === "welcome";
  // Much larger sizes to fit the screen prominently - responsive to screen width
  const logoSize = isLarge
    ? width * 0.5
    : isWelcome
    ? 120
    : isAuth
    ? 80
    : isNavbar
    ? 44
    : 50; // defaults to 50

  return (
    <View
      style={[
        styles.container,
        align === "left" && styles.containerLeft,
        style,
      ]}
    >
      <Image
        source={require("../../assets/logo.png")}
        style={[
          styles.logoImage,
          {
            width: logoSize,
            height: logoSize,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  containerLeft: {
    alignItems: "flex-start",
  },
  logoImage: {
    // Logo image styling
  },
});
