/**
 * Onboarding Screen
 * Beautiful onboarding experience with smooth animations
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ViewToken,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
  useAnimatedScrollHandler,
  SharedValue,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { completeOnboarding } from '../lib/utils/onboarding';
import { useTranslation } from '../lib/hooks/useTranslation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
}

const getOnboardingSlides = (t: (key: string) => string): OnboardingSlide[] => [
  {
    id: '1',
    title: t('onboarding.welcome'),
    description: t('onboarding.welcomeDescription'),
    icon: 'airplane-takeoff',
    color: '#0066CC',
  },
  {
    id: '2',
    title: t('onboarding.manageDocuments'),
    description: t('onboarding.manageDocumentsDescription'),
    icon: 'file-document-multiple',
    color: '#28A745',
  },
  {
    id: '3',
    title: t('onboarding.stayConnected'),
    description: t('onboarding.stayConnectedDescription'),
    icon: 'message-text',
    color: '#DC3545',
  },
  {
    id: '4',
    title: t('onboarding.getStarted'),
    description: t('onboarding.getStartedDescription'),
    icon: 'cloud-upload',
    color: '#FFC107',
  },
];

const OnboardingItem = ({
  item,
  index,
  scrollX,
}: {
  item: OnboardingSlide;
  index: number;
  scrollX: SharedValue<number>;
}) => {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const imageAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.8, 1, 0.8],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [50, 0, -50],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  const isFirstSlide = index === 0;

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <Animated.View
        style={[
          styles.iconContainer,
          imageAnimatedStyle,
          !isFirstSlide && { backgroundColor: item.color },
        ]}
      >
        {isFirstSlide ? (
          <Image
            source={require('../assets/app_logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        ) : (
          <MaterialCommunityIcons name={item.icon} size={80} color="#FFFFFF" />
        )}
      </Animated.View>

      <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </Animated.View>
    </View>
  );
};

const PaginationDot = React.memo(
  ({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const dotAnimatedStyle = useAnimatedStyle(() => {
      const width = interpolate(
        scrollX.value,
        inputRange,
        [8, 24, 8],
        Extrapolate.CLAMP
      );

      const opacity = interpolate(
        scrollX.value,
        inputRange,
        [0.3, 1, 0.3],
        Extrapolate.CLAMP
      );

      return {
        width,
        opacity,
      };
    });

    return <Animated.View style={[styles.dot, dotAnimatedStyle]} />;
  }
);

const Pagination = ({
  scrollX,
  slidesLength,
}: {
  scrollX: SharedValue<number>;
  slidesLength: number;
}) => {
  return (
    <View style={styles.pagination}>
      {Array.from({ length: slidesLength }).map((_, index) => (
        <PaginationDot key={index} index={index} scrollX={scrollX} />
      ))}
    </View>
  );
};

export default function OnboardingScreen() {
  console.log('[Onboarding] Screen rendering');
  const router = useRouter();
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);
  
  // Wrap in try-catch to handle translation errors
  let ONBOARDING_SLIDES: OnboardingSlide[] = [];
  try {
    ONBOARDING_SLIDES = getOnboardingSlides(t);
    console.log('[Onboarding] Slides loaded:', ONBOARDING_SLIDES.length);
  } catch (error) {
    console.error('[Onboarding] Error loading slides:', error);
    // Fallback slides if translation fails
    ONBOARDING_SLIDES = [
      { id: '1', title: 'Welcome', description: 'Welcome to our app', icon: 'airplane-takeoff', color: '#0066CC' },
    ];
  }

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (
        viewableItems[0]?.index !== null &&
        viewableItems[0]?.index !== undefined
      ) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = async () => {
    // Mark onboarding as completed (persists across sessions until app uninstall)
    await completeOnboarding();
    router.replace('/login');
  };

  const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Skip Button */}
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={({ item, index }) => (
          <OnboardingItem item={item} index={index} scrollX={scrollX} />
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Pagination */}
      <Pagination scrollX={scrollX} slidesLength={ONBOARDING_SLIDES.length} />

      {/* Next/Get Started Button */}
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>
          {isLastSlide ? t('onboarding.getStarted') : t('common.next')}
        </Text>
        <MaterialCommunityIcons
          name={isLastSlide ? 'check' : 'arrow-right'}
          size={24}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0066CC',
    marginHorizontal: 4,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 12,
  },
  skipText: {
    fontSize: 16,
    color: '#6C757D',
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066CC',
    marginHorizontal: 40,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#0066CC',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
});

