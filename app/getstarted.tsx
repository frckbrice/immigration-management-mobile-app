/**
 * Get Started Screen
 * Modern welcome screen shown before onboarding
 * Displays company branding and introduces the app
 */

import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
} from 'react-native-reanimated';
// Get Started is part of onboarding flow - no separate tracking needed
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '@/lib/hooks/useTranslation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function GetStartedScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const imageScale = useSharedValue(0.9);
    const imageOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(30);
    const textOpacity = useSharedValue(0);
    const buttonScale = useSharedValue(0.8);
    const buttonOpacity = useSharedValue(0);
    const iconRotation = useSharedValue(0);

    useEffect(() => {
        // Animate image entrance
        imageScale.value = withSpring(1, { damping: 15, stiffness: 100 });
        imageOpacity.value = withTiming(1, { duration: 800 });

        // Animate text entrance
        textTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });
        textOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));

        // Animate button entrance
        buttonScale.value = withSpring(1, { damping: 15, stiffness: 100 });
        buttonOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));

        // Animate icon rotation
        iconRotation.value = withRepeat(
            withSequence(
                withTiming(10, { duration: 1000 }),
                withTiming(-10, { duration: 1000 }),
                withTiming(0, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    const imageAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: imageScale.value }],
        opacity: imageOpacity.value,
    }));

    const textAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: textTranslateY.value }],
        opacity: textOpacity.value,
    }));

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
        opacity: buttonOpacity.value,
    }));

    const iconAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${iconRotation.value}deg` }],
    }));

    const handleGetStarted = () => {
        // Navigate to onboarding - onboarding completion will be tracked there
        router.replace('/onboarding');
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Full Screen Background Image */}
            <Animated.View style={[styles.imageWrapper, imageAnimatedStyle]}>
                <Image
                    source={require('./getstarted/patrick image homw.webp')}
                    style={styles.backgroundImage}
                    resizeMode="cover"
                />

                {/* Dark Overlay Gradient for Text Readability */}
                <LinearGradient
                    colors={[
                        'rgba(0, 0, 0, 0.4)',
                        'rgba(0, 0, 0, 0.5)',
                        'rgba(0, 0, 0, 0.7)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.overlay}
                />
            </Animated.View>

            {/* Content Overlay */}
            <SafeAreaView style={styles.contentWrapper} edges={['top', 'bottom']}>
                {/* Top Text Section */}
                <Animated.View style={[styles.textSection, textAnimatedStyle]}>
                    <Text style={styles.welcomeText}>{t('getStarted.welcomeTo')}</Text>
                    <Text style={styles.companyName}>{t('getStarted.companyName')}</Text>
                    <Text style={styles.tagline}>
                        {t('getStarted.tagline')}
                    </Text>
                    <Text style={styles.description}>
                        {t('getStarted.description')}
                    </Text>
                </Animated.View>

                {/* Bottom CTA Button */}
                <AnimatedTouchableOpacity
                    style={[styles.getStartedButton, buttonAnimatedStyle]}
                    onPress={handleGetStarted}
                    activeOpacity={0.9}
                >
                    <LinearGradient
                        colors={['#FF8C42', '#FF6B35', '#FF5722']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        <Text style={styles.buttonText}>{t('getStarted.getStartedButton')}</Text>
                        <Animated.View style={iconAnimatedStyle}>
                            <MaterialCommunityIcons
                                name="arrow-right"
                                size={24}
                                color="#FFFFFF"
                            />
                        </Animated.View>
                    </LinearGradient>
                </AnimatedTouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    imageWrapper: {
        ...StyleSheet.absoluteFillObject,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    contentWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
    },
    textSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    welcomeText: {
        fontSize: 16,
        fontWeight: '400',
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 8,
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    companyName: {
        fontSize: 42,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
        lineHeight: 50,
    },
    tagline: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.95)',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 26,
        paddingHorizontal: 16,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    description: {
        fontSize: 15,
        fontWeight: '400',
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    getStartedButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 20,
        shadowColor: '#FF6B35',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 12,
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 32,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginRight: 12,
        letterSpacing: 0.5,
    },
});

