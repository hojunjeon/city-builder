import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ToolbarAction = {
  id: string;
  label: string;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
};

type Props = {
  actions: readonly ToolbarAction[];
};

export function Toolbar({ actions }: Props) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {actions.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: action.disabled, selected: action.active }}
            disabled={action.disabled}
            onPress={action.onPress}
            style={({ pressed }: { pressed: boolean }) => [
              styles.button,
              action.active && styles.buttonActive,
              action.danger && styles.buttonDanger,
              action.disabled && styles.buttonDisabled,
              pressed && !action.disabled && styles.buttonPressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                action.active && styles.labelActive,
                action.danger && styles.labelDanger,
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#d5ddd5',
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 6,
  },
  button: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#d5ddd5',
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  buttonActive: {
    borderColor: '#2f7d4a',
    backgroundColor: '#dff1e4',
  },
  buttonDanger: {
    borderColor: '#ddb6b6',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.68,
  },
  label: {
    color: '#18231c',
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: '#185c31',
  },
  labelDanger: {
    color: '#a83535',
  },
});
